var scripts = document.getElementsByTagName('script');
var path = scripts[scripts.length-1].src.slice(0, -11);

var latexjsScript = document.createElement('script');
latexjsScript.src = path + 'latex.js';
document.head.appendChild(latexjsScript);

var basicGenerator;

function CustomGenerator(customArgs, customPrototype) {
  var generator = new latexjs.HtmlGenerator({
      CustomMacros: (function() {
        var args      = CustomMacros.args = customArgs,
            prototype = CustomMacros.prototype = customPrototype;
    
        function CustomMacros(generator) {
          this.g = generator;
        }
    
        // enumerate
        // args['enumerate'] = ['V']
        // prototype['enumerate'] = function() {
        //   let ol = document.createElement('ol');
        //   ol.classList.add('list');
        //   ol.classList.add('dash');
        //   return [ol];
        // };

    
      return CustomMacros;
      }())
  });
  return generator;
}

function removeArgs(latex, command) {
  return latex;
}

// remove arguments that cannot be processed
function ltxclean(latex) {


  // clean enumerate
  var i = 0;
  while (latex.indexOf('\\begin{enumerate}', i) > -1) {
    let begin = latex.indexOf('\\begin{enumerate}', i) + 17;
    if (latex.indexOf('[', begin) == begin) {
      let end = latex.indexOf(']', begin),
          endOfLine = latex.indexOf('\n', begin);
      if (end == -1 || end > endOfLine) {
        throw {
          message: `syntax error: missing end of arguments ']'`,
          line: latex.substring(0, endOfLine).split('\n').length
        }
      }
      let args = latex.substring(begin+1, end);
      if (args.indexOf('label=\\alph*)') > -1) {
        latex = latex.substring(0, begin) + '[label=\\alph*)]' + latex.substring(end+1);
        begin += 15;
      } else {
        latex = latex.substring(0, begin) + latex.substring(end+1);
      }
    } 

    let depth = 1;
    i = begin;
    while((latex.indexOf('\\begin{enumerate}', i) > -1 || latex.indexOf('\\end{enumerate}', i) > -1) && depth > 0) {
      let b = latex.indexOf('\\begin{enumerate}', i),
          e = latex.indexOf('\\end{enumerate}', i);
      if ((b > -1 && e > -1 && b < e) || (b > -1 && e == -1)) {
        i = b + 1;
        depth++;
      } else {
        end = e;
        i = e + 1;
        depth--;
      }
    }
    
    if (depth == 0) {
      let sublatex = latex.substring(begin, end);
      latex = latex.substring(0, begin) + removeArgs(sublatex, '\\begin{enumerate}') + latex.substring(end);
    }
  }
  return latex;
}


function ltx2html(latex, parentElement, generator = basicGenerator) {
  if (!generator) {
    latexjsScript.addEventListener('load', function () {
      ltx2html(latex, parentElement);
    });
  } else {
    generator.reset();
    parentElement.innerHTML = '';

    // CLEAN
    latex = ltxclean(latex);

    // PRE PROCESSING

    // alphabetic enumerate
    let i = 0,
        depth = 0,
        alphEnumerate = false;
    while(latex.indexOf('\\begin{enumerate}', i) > -1 || latex.indexOf('\\end{enumerate}', i) > -1) {
      let b = latex.indexOf('\\begin{enumerate}', i),
          e = latex.indexOf('\\end{enumerate}', i);
      if ((b > -1 && e > -1 && b < e) || (b > -1 && e == -1)) {
        if (depth == 0 && latex.indexOf('[label=\\alph*)]', b) == b+17) {
          latex = latex.substring(0, b) + '\\begin{enumerate}\\begin{enumerate}' + latex.substring(b+32);
          alphEnumerate = true;
          i = b + 18;
        }
        else {
          i = b + 1;
        }
        depth++;
      } else {
        if (depth == 1 && alphEnumerate) {
          latex = latex.substring(0, e) + '\\end{enumerate}' + latex.substring(e);
          alphEnumerate = false;
          i = e + 16;
        } else {
          i = e + 1;
        }
        depth--;
      }
    }

    const ltx = `\\documentclass{article}

\\usepackage{comment, multicol}
\\usepackage{hyperref}
\\usepackage{calc,pict2e,picture}
\\usepackage{textgreek,textcomp,gensymb,stix}

\\begin{document}

${latex}

\\end{document}`;

    // MAIN PROCESSING
    try {
      generator = latexjs.parse(ltx, { generator: generator });
    }
    catch (e) {
      // return error
      let line = e.location.start.line > 9 ? e.location.start.line - 9 : 1;
      throw {
        message: e.message,
        line: line,
      }
    }

    // POST PROCESSING
    // line break at the end paragraphs
    let child = generator.domFragment().firstChild;
    while (child.innerHTML.indexOf('<br></p>') > -1) {
      child.innerHTML = child.innerHTML.replace('<br></p>', '<br>&nbsp;</p>');
    }

    // remove first parenthesis in alphabetic enumerate
    for (el of child.getElementsByClassName('itemlabel')) {
      el.innerHTML = el.innerHTML.replace('(', '');
    }


    // display
    parentElement.classList.add('ltx');
    parentElement.appendChild(child);
  }
}

latexjsScript.addEventListener('load', function () {
  basicGenerator = CustomGenerator({}, {})
  basicGenerator = latexjs.parse('\\documentclass{article}\n\\begin{document}\n\\end{document}',
    { generator: basicGenerator });
  document.head.appendChild(basicGenerator.stylesAndScripts(path));
});