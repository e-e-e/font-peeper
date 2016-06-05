console.log('working');

chrome.extension.onRequest.addListener(request_listener);

var website = window.location.href;


function request_listener(request, sender, sendResponse) {
 switch(request.action) {
 		case "getFonts":
 			collect_fonts(sendResponse);
 			break;
 		case "downloadFont":
 			console.log(request);
 			download_font(request.url, request.filename);
 			//sendResponse({});
 			break;
 		default:
 			if(sendResponse) sendResponse({});
 }
}

/*
 *
 * Functions for downloading
 *
 */

 function download_font(url,filename){

 	if(url.indexOf('data:')===0) {
		chrome_download(url,filename);
		return;
 	}

 	//click_download(url, filename)
	var xhr = new XMLHttpRequest();
  xhr.responseType = 'arraybuffer';//'blob';

  xhr.addEventListener('load', function (e) {
  	var status = e.currentTarget.status;
  	if(status===200) {
      var blob = new Blob([xhr.response]);
      var reader = new FileReader();
      var datauri = reader.readAsDataURL(blob);
      reader.onloadend = function () {
    		console.log(reader.result);
    		chrome_download(url,filename);
  		};
    } else {
    	
    	console.log('DATAURI failed');
    	click_download(url,filename);
    }
  });

  xhr.addEventListener('error', function(e){
  	console.log('FAILED');
  	console.log(e);
  });

  xhr.open('get', url, true);
  xhr.send();
}

function chrome_download (url, filename) {
	chrome.runtime.sendMessage({ action:'download', options:{url: url, filename:filename}}, function(response) {
  console.log(response.farewell);
	});
}

function click_download(url, filename) {
	var a = document.createElement('a');
 	 a.href = url;
 	 a.target = '_blank';
 	 a.download = filename;
 	 a.click();
}

/*
 *
 * Functions for collecting font data
 *
 */

function collect_fonts (callback) {
  var promises = [];
  var o = {},
  sheets = document.styleSheets,
	rule = null,
	i = sheets.length, j;

	$.each(sheets, process_stylesheet);
	$.when.apply(undefined, promises).promise().done(function() {
		callback(o);
	}).fail(function(){ callback(o);});

	function process_stylesheet(i,sheet){
		var def = new $.Deferred();
		promises.push(def);
		if (sheet.cssRules ===null && sheet.rules === null) {
			console.log("getting %s", sheet.href);
			$.ajax({
			  url: sheet.href,
			  context: {url:sheet.href }
			}).done(process_remote)
			.fail(function(err){
				console.log('AJAX failed %s',sheet.href);
				console.log(err);
			})
			.always(def.resolve);
		} else {
			rules = sheet.cssRules || sheet.rules || [];
			$.each(rules, process_rules);
			def.resolve();
		}
	}

	function process_remote(html) {
		console.log("YES"+this.url);
		var fonts = process_fontface_css(html,this.url);
		fonts.forEach(function(e) {
			o[e.name] = o[e.name] || {};
			o[e.name][e.raw]=e.srcs;
		});
	}

	function process_rules(i,rule){
		if(rule.toString() == "[object CSSImportRule]") {
			var rules = rule.styleSheet.cssRules || rule.styleSheet.rules || [];
			$.each(rules, process_rules);
		} else if( rule.toString() == "[object CSSFontFaceRule]" ) {
			console.log(rule)
			// rule.style.fontFamily works in Chrome chrome; Not in FF. For IE I don't know yet.
			fontFamily = rule.style.fontFamily || rule.style.cssText.match(/font-family\s*:\s*([^;\}]*)\s*[;}]/i)[1];
			// To prevent duplicates we use the cssText as key 
			o[ fontFamily ] = o[ fontFamily ] || {} ;
			o[ fontFamily ][rule.style.cssText] = ff_get_srcs(rule.style.cssText) ;
		}
	}
}

function process_fontface_css(src, base) {
	//console.log("GOT %s", src);
	var re_fontface = /@font-face\s*\{[\s\S]*?\}/gi;
	var fonts = [];
	var result;
	while ((result = re_fontface.exec(src)) !== null) {
		var fontface = result[0];
		var name = ff_get_fontfamily(fontface);
		var srcs = ff_get_srcs(fontface, base);
		//console.log("FONT:"+name);
		fonts.push({name:name, srcs: srcs, raw:fontface});
	}
	return fonts;
}

function ff_get_fontfamily(src) {
	var re_fontfamily = /font-family\s*:(.*?);/g;
	result = re_fontfamily.exec(src);
	return (result===null)? '' : result[1].trim();
}

function ff_get_srcs(src, base) {
	var re_fontsource = /src\s*:[\s\S]*;/g;
	var re_fonturl = /url\((?:'|")?(.+?)(?:'|")?\)(\s+format\((.*?)\))?/g;
	var re_fontstyle =/font-style:\s*([\s\S]*?);/i;
	var re_fontweight =/font-weight:\s*([\s\S]*?);/i;
	var srcs = [];
	var result;
	var style = src.match(re_fontstyle);
	//console.log(style);
	style = (!style)? 'normal' : style[1]; 
	var weight = src.match(re_fontweight);
	weight = (!weight)? 'normal': weight[1] ; 
	//console.log(style +'' + weight);
	while((result = re_fontsource.exec(src))!== null) {
		var srctag = result[0];
		re_fonturl.lastIndex = 0;
		var x;
		while((x=re_fonturl.exec(srctag))!==null) {
			//need to make url absolute.
			var f = x[3];
			if(f) {
				f = f.replace(/['"]/g,'');
			}
			//console.log(absolute_url(x[1]));
			srcs.push({url:absolute_url(x[1],base),format:f});
		}
	}
	return {srcs:srcs, style:style, weight:weight};
}

function absolute_url(url, b) {
	var base = b || website;
	//console.log(url);
	if(url.indexOf('//')===0) {
		//console.log('.....');
		return 'http:'+ url;
	} else if( url.indexOf('http')===0 || url.indexOf('data:')===0){
		//console.log('hhte');
		return url;
	}
	var uri = new URI(url);
	console.log(base + "\b>>"+ url);
	return uri.absoluteTo(base).toString();
}
