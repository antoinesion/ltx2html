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
    
        args['rem'] = ['V']
        prototype['rem'] = function() {
          //let span = document.createElement('span');
          //span.classList.add('remark');
          //span.innerHTML = remark.data;
          return [document.createElement('div')];
        };
    
      return CustomMacros;
      }())
  });
  return generator;
}


function ltx2html(latex, parentElement, generator = basicGenerator) {
  if (!generator) {
    latexjsScript.addEventListener('load', function () {
      ltx2html(latex, parentElement);
    });
  } else {
    generator.reset();
    parentElement.innerHTML = '';

    const ltx = `\\documentclass{article}

\\usepackage{comment, multicol}
\\usepackage{hyperref}
\\usepackage{calc,pict2e,picture}
\\usepackage{textgreek,textcomp,gensymb,stix}

\\begin{document}

${latex}

\\end{document}`;

    try {
      generator = latexjs.parse(ltx, { generator: generator });
    }
    catch (e) {
      return e.message;
    }

    let child = generator.domFragment().firstChild;
    while (child.innerHTML.indexOf('<br></p>') > -1) {
      child.innerHTML = child.innerHTML.replace('<br></p>', '<br>&nbsp;</p>');
    }
    parentElement.classList.add('ltx');
    parentElement.appendChild(child);

    return null;
  }
}

latexjsScript.addEventListener('load', function () {
  basicGenerator = CustomGenerator({}, {})
  basicGenerator = latexjs.parse('\\documentclass{article}\n\\begin{document}\n\\end{document}',
    { generator: basicGenerator });
  document.head.appendChild(basicGenerator.stylesAndScripts(path));
});