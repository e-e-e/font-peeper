$(document).ready(function() {
	chrome.tabs.getSelected(null, function(tab) {
	  // Send a request to the content script.
	  chrome.tabs.sendRequest(tab.id, {action: "getFonts"}, get_fonts_reply);
	});
});

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.action === "download")
      chrome.downloads.download(request.options);
  });

function get_fonts_reply(response) {
	if(response) {
		for (var font in response) {
			for (var src in response[font]) {
				display_font(font, response[font][src],src);
			}
		}
	} else {
		$('<h2></h2>').text('No Fonts Found').appendTo($('body'));
		console.log('something');
	}
}

function display_font(n, data, raw_src) {
	var body = $('body');
	var name = n.replace(/["']/g,'').trim().replace(/[\s-]+/g,'-');
	if(data.style!=='normal')
		name+='_'+data.style;
	if(data.weight!=='normal')
		name+='_'+data.weight;
	//title
	title = $('h2.'+name);
	if(title.length===0) {
		title = $('<h2>'+name+'</h2>')
			.addClass(name)
			.appendTo(body);
		// show source link
		$('<div></div>')
			.addClass("link")
			.text('show source')
			.click(function() {
				$(".raw_src, div."+name).toggle();
			}).appendTo(title);
			$('<p></p>')
				.text("style = "+data.style + " and weight = "+data.weight)
				.appendTo(body);
	}
	//append source
	$('<div></div>')
		.addClass('raw-src')
		.addClass(name)
		.text(raw_src)
		.insertAfter(title).hide();

	//append download links
	var links = $('p.'+name);
	if(links.length===0) {
		links = $('<p></p>')
		.addClass(name)
		.appendTo(body);
	}
	data.srcs.forEach(function(e) {
		$('<div href="'+e.url+'">'+e.format+'</div>')
		.addClass('link')
		.appendTo(links)
		.click(download_link);
	});

	//add font-face styles 
	var urls = data.srcs.map(function(e) {
		var src = 'url('+e.url+')';
		if(e.format) 
			src += ' format("'+e.format+'")';
		return src;
	});
	var fontface = "@font-face { font-family:"+n+"; src:" + urls.join() + "; font-weight:"+data.weight+"; font-style:"+data.style+"} h2."+name+"{font-family:"+n+"; font-weight:"+data.weight+"; font-style:"+data.style+";}";
	$('<style type="text/css"></style>')
		.text(fontface)
		.prependTo($('head'));

	//
	function download_link() {
		var format = $(this).text();
		var href = $(this).attr('href');
		switch (format) {
			case 'embedded-opentype':
				format = 'eot';
				break;
			case 'truetype':
				format = 'ttf';
				break;
			case 'undefined':
				format = 'font';
		}

		chrome.tabs.getSelected(null, function(tab) {
		  // Send a request to the content script.
		  chrome.tabs.sendRequest(tab.id, { 
		  	action: "downloadFont", 
		  	url:  href,
		  	filename:name +"."+ format });
		});

		// chrome.downloads.download({ 
		// 	url: $(this).attr('href'),
		// 	filename:name +"."+ format
		// });
	}

}
