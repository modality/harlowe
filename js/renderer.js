define(['utils', 'markup', 'twinescript/compiler', 'internaltypes/twineerror'], function(Utils, TwineMarkup, Compiler, TwineError) {
	"use strict";
	/**
		The Renderer takes the syntax tree from TwineMarkup and returns a HTML string.
		
		Among other responsibilities, it's the intermediary between TwineMarkup and TwineScript -
		macros and expressions become <tw-expression> and <tw-macro> elements alongside other
		markup syntax (with their compiled JS code attached as attributes), and the consumer of
		the HTML (usually Section) can run that code in the Environ.
		
		@class Renderer
		@static
	*/
	
	/*
		This makes a basic enclosing HTML tag with no attributes, given the tag name,
		and renders the contained text.
	*/
	function renderTag(token, tagName) {
		var contents = Renderer.render(token.children);
		return contents && Utils.wrapHTMLTag(contents, tagName);
	}

	/*
		Text constant used by align().
		The string "text-align: " is selected by the debugmode CSS, so the one space
		must be present.
	*/
	var center = "text-align: center; max-width:50%; ",
		escape = Utils.escape,
		/*
			The public Renderer object.
		*/
		Renderer = {
		
		/**
			Renderer accepts the same story options that Harlowe does.
			Currently it only makes use of { debug }.
			
			@property options
			@type Object
		*/
		options: {},
		
		/**
			A composition of TwineMarkup.lex and Renderer.render,
			but with a (currently rudimentary) memoizer.
		*/
		exec: (function() {
			/*
				These two vars cache the previously rendered source text, and
				the syntax tree returned by TwineMarkup.lex from that.
			*/
			var cachedInput,
				cachedOutput;

			return function(src) {
				// If a non-string is passed into here, there's really nothing to do.
				if (typeof src !== "string") {
					Utils.impossible("Renderer.exec", "source was not a string, but " + typeof src);
					return "";
				}
				
				if (src === cachedInput) {
					return cachedOutput;
				}
				cachedInput = src;
				cachedOutput = this.render(TwineMarkup.lex(src).children);
				return cachedOutput;
			};
		}()),
		
		/**
			The recursive rendering method.
			
			@method render
			@static
			@param {Array} tokens A TwineMarkup token array.
			@return {String} The rendered HTML string.
		*/
		render: function render(tokens) {
			var token,
				// Cache the tokens array length
				len,
				// Hoisted vars, used only by the numbered/bulleted case
				tagName, depth,
				// Hoisted vars, used only by the align case
				style, body, align, j,
				
				// This is the for-i loop variable. Speed concerns lead me to use
				// a plain for-i loop for this renderer.
				i = 0,
				// The output string.
				out = '';
			
			if (!tokens) {
				return out;
			}
			len = tokens.length;
			for(; i < len; i += 1) {
				token = tokens[i];
				switch(token.type) {
					case "twine1Macro": {
						out += TwineError.create("macrocall","Twine 2 macros use a different syntax to Twine 1 macros.")
							.render(escape(token.text))[0].outerHTML;
						break;
					}
					case "numbered":
					case "bulleted": {
						// Run through the tokens, consuming all consecutive list items
						tagName = (token.type === "numbered" ? "ol" : "ul");
						out += "<" + tagName + ">";
						depth = 1;
						while(i < len && tokens[i] && tokens[i].type === token.type) {
							/*
								For differences in depth, raise and lower the <ul> depth
								in accordance with it.
							*/
							out += ("<" + tagName + ">").repeat(Math.max(0, tokens[i].depth - depth));
							out += ("</" + tagName + ">").repeat(Math.max(0, depth - tokens[i].depth));
							depth = tokens[i].depth;
							
							out += renderTag(tokens[i], "li");
							i += 1;
							// If a <br> follows a listitem, ignore it.
							if (tokens[i] && tokens[i].type === "br") {
								i+=1;
							}
						}
						out += ("</" + tagName + ">").repeat(depth + 1);
						break;
					}
					case "align": {
						while(token && token.type === "align") {
							style = '';
							body = '';
							align = token.align;
							j = (i += 1);
							
							/*
								Base case.
							*/
							if (align === "left") {
								break;
							}
							/*
								Crankforward until the end tag is found.
							*/
							while(i < len && tokens[i] && tokens[i].type !== "align") {
								i += 1;
							}
							
							body += render(tokens.slice(j, i));
							
							switch(align) {
								case "center":
									style += center + "margin-left: auto; margin-right: auto;";
									break;
								case "justify":
								case "right":
									style += "text-align: " + align + ";";
									break;
								default:
									if (+align) {
										style += center + "margin-left: " + align + "%;";
									}
							}
							
							out += '<tw-align ' + (style ? ('style="' + style + '"') : '')
								+ (Renderer.options.debug ? ' title="' + token.text + '"' : "")
								+ '>' + body + '</tw-align>\n';
							token = tokens[i];
						}
						break;
					}
					case "heading": {
						out += renderTag(token, 'h' + token.depth);
						break;
					}
					case "br":
					case "hr": {
						out += '<' + token.type + '>';
						break;
					}
					case "comment": {
						break;
					}
					case "inlineUrl": {
						out += '<a class="link" href="' + escape(token.text) + '">' + token.text + '</a>';
						break;
					}
					case "scriptStyleTag":
					case "tag": {
						out += token.text;
						break;
					}
					case "sub": // Note: there's no sub syntax yet.
					case "sup":
					case "del":
					case "strong":
					case "em": {
						out += renderTag(token, token.type);
						break;
					}
					case "bold": {
						out += renderTag(token, "b");
						break;
					}
					case "italic": {
						out += renderTag(token, "i");
						break;
					}
					case "twineLink": {
						/*
							This crudely desugars the twineLink token into a
							(link-goto:) token.
						*/
						var newTwineLinkToken = TwineMarkup.lex("(link-goto:"
							+ Utils.toJSLiteral(token.innerText) + ","
							+ Utils.toJSLiteral(token.passage) + ")");
						out += render(newTwineLinkToken.children);
						break;
					}
					case "hook": {
						out += '<tw-hook '
							+ (token.name ? 'name="' + token.name + '"' : '')
							// Debug mode: show the hook destination as a title.
							+ ((Renderer.options.debug && token.name) ? ' title="Hook: ?' + token.name + '"' : '')
							+ ' prose="' + escape(token.innerText) + '">'
							+'</tw-hook>';
						break;
					}
					case "verbatim": {
						out += escape(token.verbatim)
							/*
								The only replacement that should be done is \n -> <br>. In
								browsers, even if the CSS is set to preserve whitespace, copying text
								still ignores line breaks that aren't explicitly set with <br>s.
							*/
							.replace(/\n/g,'<br>');
						break;
					}
					case "collapsed": {
						out += renderTag(token, "tw-collapsed");
						break;
					}
					/*
						Expressions
					*/
					case "hookRef":
					case "variable":
					case "macro": {
						out += '<tw-expression type="' + token.type + '" name="' + escape(token.name || token.text) + '"'
							// Debug mode: show the macro name as a title.
							+ (Renderer.options.debug ? ' title="' + escape(token.text) + '"' : '')
							+ ' js="' + escape(Compiler(token)) + '">'
							+ '</tw-expression>';
						break;
					}
					/*
						Base case
					*/
					default: {
						out += token.children && token.children.length ? render(token.children) : token.text;
						break;
					}
				}
			}
			return out;
		}
	};
	
	return Object.freeze(Renderer);
});
