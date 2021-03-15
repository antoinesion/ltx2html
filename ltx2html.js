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
    
      return CustomMacros;
      }())
  });
  return generator;
}

function removeArgs(latex, command, linesup = 0) {
  while (latex.indexOf(command+'{') > -1 || latex.indexOf(command+'[') > -1) {
    let i = latex.indexOf(command+'{') > -1 ? latex.indexOf(command+'{') : latex.indexOf(command+'[');
    let end = latex.indexOf(command+'{') > -1 ? '}' : ']';
    let e = latex.indexOf(end, i+command.length),
        endOfLine = latex.indexOf('\n', i+command.length);
    if (e == -1 || e > endOfLine) {
      throw {
        message: `syntax error: missing end of arguments '${end}'`,
        line: linesup + latex.substring(0, endOfLine).split('\n').length
      }
    }
    latex = latex.substring(0,i+command.length) + latex.substring(e+1);
  }
  return latex;
}

// remove arguments that cannot be processed
function ltxclean(latex) {

  // clean itemize
  latex = removeArgs(latex, '\\begin{itemize}');
  console.log(latex);

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
      latex = latex.substring(0, begin) + removeArgs(sublatex, '\\begin{enumerate}',
        latex.substring(0, begin).split('\n').length - 1)+ latex.substring(end);
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

    // spaces
    while (latex.indexOf('\\:') > -1) {
      latex = latex.replace('\\:', '\\,')
    }
    while (latex.indexOf('\\;') > -1) {
      latex = latex.replace('\\;', '\\ ')
    }
    while (latex.indexOf('\\!') > -1) {
      latex = latex.replace('\\!', '')
    }

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
      let line = e.location.start.line > 9 ? e.location.start.line - 9 : 0;
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