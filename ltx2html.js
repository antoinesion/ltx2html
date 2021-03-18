var scripts = document.getElementsByTagName('script');
var path = scripts[scripts.length-1].src.slice(0, -11);

var latexjsScript = document.createElement('script');
latexjsScript.src = path + 'latex.js';
document.head.appendChild(latexjsScript);

var basicGenerator;

function createCell(content) {
  if (content && content.classList && content.classList.contains('multicolumn')) {
    return content;
  }
  
  let cell = document.createElement('div');
  cell.classList.add('cell');
  if (content) {
    cell.appendChild(content);
  } else {
    cell.classList.add('empty');
  }
  return cell;
}

function CustomGenerator(customArgs, customPrototype) {
  var generator = new latexjs.HtmlGenerator({
      CustomMacros: (function() {
        var args      = CustomMacros.args = customArgs,
            prototype = CustomMacros.prototype = customPrototype;
    
        function CustomMacros(generator) {
          this.g = generator;
        }

        // CUSTOM MACROS

        // minipage
        args['minipage'] = ['V', 'i?', 'g']
        prototype['minipage'] = function (adjustment, width) {
          width = width.data;

          let minipage = document.createElement('div')
          minipage.classList.add('minipage');
          if (width.includes('w')) {
            minipage.style.width = parseFloat(width.split('w')[0])*100 + '%';
          } else {
            minipage.style.width = width;
          }

          if (adjustment) {
            minipage.classList.add(adjustment);
          }
          return [minipage]
        }

        // fbox
        args['fbox'] = ['V', 'g']
        prototype['fbox'] = function (content) {
          let fbox = document.createElement('div');
          fbox.classList.add('hbox');
          fbox.classList.add('frame');
          fbox.appendChild(content);
          return [fbox];
        }

        // tabular
        args['tabular'] = ['V', 'g', 'g']
        prototype['tabular'] = function (template, content) {
          let tabular = document.createElement('div');
          tabular.classList.add('tabular');
          tabular.style.gridTemplateColumns = '';

          if (!template) {
            return [tabular]
          }
          if (template.childNodes.length > 0) {
            template = template.childNodes[0].wholeText.replace(' ', '');
          } else {
            template = template.data.replace(' ', '');
          }

          let gridTemplateColumns = '',
              columns = template;
          while (columns.includes('|')) {
            columns = columns.replace('|', '');
          }
          tabular.dataset.columns = columns.length;

          for (let i = 0; i < columns.length; i++) {
            if (columns[i] == 'p') {
              let e = columns.indexOf('}', i);
              let width = columns.substring(i+2, e);
              if (width.includes('w')) {
                gridTemplateColumns += parseFloat(width.split('w')[0])*100 + '%';
              } else {
                gridTemplateColumns += width;
              }
              i = e;
            } else {
              gridTemplateColumns += 'max-content';
            }
            
            if (i < columns.length - 1) {
              gridTemplateColumns += ' ';
            }
          }
          tabular.style.gridTemplateColumns = gridTemplateColumns;

          while (template.includes('{')) {
            let b = template.indexOf('{'),
                e = template.indexOf('}');
            template = template.substring(0, b) + template.substring(e+1);
          }

          tabular.dataset.template = template;
          tabular.appendChild(createCell(content));
          return [tabular];
        }

        args['repeatcell'] = ['H', 'n', 'g']
        prototype['repeatcell'] = function (number, column) {
          if (!column) {
            return []
          }
          return [column.data.repeat(number)];
        }

        args['pcell'] = ['H', 'g']
        prototype['pcell'] = function (length) {
          if (!length) {
            return []
          }
          length = length.data;
          return ['p{' + length + '}']
        }

        // hline
        args['hline'] = ['V', 'g']
        prototype['hline'] = function (content) {
          return [document.createElement('hr'), createCell(content)];
        }

        // endline
        args['endline'] = ['V', 'g']
        prototype['endline'] = function (content) {
          let endline = document.createElement('div');
          endline.classList.add('endline');
          return [endline, createCell(content)];
        }

        // nextcell
        args['nextcell'] = ['V', 'g']
        prototype['nextcell'] = function(content) {
          return [createCell(content)];
        };

        // multicolumn
        args['multicolumn'] = ['V', 'n', 'g', 'g']
        prototype['multicolumn'] = function (number, template, content) {
          if (!template || !template.data) {
            throw {
              message: `syntax error: wrong multicolumn argument '${template}'`
            }
          }
          template = template.data;

          let cell = document.createElement('div');
          cell.classList.add('cell');
          cell.classList.add('multicolumn');
          cell.dataset.columns = number;
          cell.dataset.template = template;

          if (content) {
            cell.appendChild(content);
          } else {
            cell.classList.add('empty');
          }

          return [cell];
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
        message: `syntax error: missing end of arguments '${end}'`
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

  // clean enumerate
  var i = 0;
  while (latex.includes('\\begin{enumerate}', i)) {
    let begin = latex.indexOf('\\begin{enumerate}', i) + 17;
    if (latex.indexOf('[', begin) == begin) {
      let end = latex.indexOf(']', begin),
          endOfLine = latex.indexOf('\n', begin);
      if (end == -1 || end > endOfLine) {
        throw {
          message: `syntax error: missing end of arguments ']'`
        }
      }
      let args = latex.substring(begin+1, end);
      if (args.includes('label=\\alph*)')) {
        latex = latex.substring(0, begin) + '[label=\\alph*)]' + latex.substring(end+1);
        begin += 15;
      } else {
        latex = latex.substring(0, begin) + latex.substring(end+1);
      }
    } 

    let depth = 1;
    i = begin;
    while((latex.includes('\\begin{enumerate}', i) || latex.includes('\\end{enumerate}', i)) && depth > 0) {
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

  // textwidth
  while (latex.includes('\\textwidth')) {
    latex = latex.replace('\\textwidth', '\\linewidth');
  }

  return latex;
}


function ltx2html(latex, parentElement, generator = basicGenerator) {
  if (!generator) {
    latexjsScript.addEventListener('load', function () {
      ltx2html(latex, parentElement);
    });
  } else {

    // CLEAN
    latex = ltxclean(latex);

    // PRE PROCESSING

    // spaces
    while (latex.includes('\\:')) {
      latex = latex.replace('\\:', '\\,');
    }
    while (latex.includes('\\;')) {
      latex = latex.replace('\\;', '\\ ');
    }
    while (latex.includes('\\!')) {
      latex = latex.replace('\\!', '');
    }

    // linewidth
    while (latex.includes('\\linewidth')) {
      latex = latex.replace('\\linewidth', 'w');
    }

    // alphabetic enumerate
    let i = 0,
        depth = 0,
        alphEnumerate = false;
    while(latex.includes('\\begin{enumerate}', i) || latex.includes('\\end{enumerate}', i)) {
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

    // tabular
    let spaces = [' ', '\n', '\t'];
    function setTabularMacros(latex) {
      let i = 0;
      while (latex.includes('\\hline', i)) {
        let h = latex.indexOf('\\hline', i);
        latex = latex.substring(0,h) + '}\\hline{' + latex.substring(h+6);
        i = h + 2;
      }
      i = 0;
      while (latex.includes('\\cline', i)) {
        let c = latex.indexOf('\\cline', i);
        latex = latex.substring(0,c) + '}\\cline{' + latex.substring(c+6);
        i = c + 2;
      }

      let mathMode = false;
      for (let i = 0; i < latex.length; i++) {
        if (latex[i] == '$') {
          mathMode = !mathMode;
        }

        if (!mathMode) {
          if (latex[i] == '&') {
          latex = latex.substring(0, i) + '}\\nextcell{' + latex.substring(i+1);
          i-=2;
          } else if (spaces.includes(latex[i]) && (i == 0 || i == latex.length - 1)) {
            latex = latex.substring(0, i) + latex.substring(i+1);
            i--;
          } else if (i < latex.length - 1) {
            if (latex[i] == '\\' && latex[i+1] == '\\') {
              latex = latex.substring(0, i) + '}\\endline{' + latex.substring(i+2);
              i-=2;
            } else if (latex[i] == '{' && spaces.includes(latex[i+1])) {
              latex = latex.substring(0, i+1) + latex.substring(i+2);
              i--;
            } else if (spaces.includes(latex[i]) && (spaces.includes(latex[i+1]) || latex[i+1] == '}')) {
              latex = latex.substring(0, i) + latex.substring(i+1);
              i--;
            }
          }
        }
      }
      return latex;
    }

    i = 0; depth = 0;
    let firstStart;
    while(latex.includes('\\begin{tabular}', i) || latex.includes('\\end{tabular}', i)) {
      let b = latex.indexOf('\\begin{tabular}', i),
          e = latex.indexOf('\\end{tabular}', i);
      if ((b > -1 && e > -1 && b < e) || (b > -1 && e == -1)) {
        if (latex.indexOf('\\begin{tabular}{', i) == b) {
          let argsStart = latex.indexOf('}{', i)+2;
          let argsEnd = argsStart,
              stack = 0;
          while((stack > 0 || latex[argsEnd] != '}') && argsEnd < latex.length) {
            if (latex[argsEnd] == '{') {
              stack++;
            } else if (latex[argsEnd] == '}') {
              stack--;
            }
            argsEnd++;
          }
          if (argsEnd == latex.length) {
            break;
          }
          let args = latex.substring(argsStart, argsEnd);
          while (args.includes(' ')) {
            args = args.replace(' ', '');
          }
          
          let j = args.indexOf('p');
          while (j > -1) {
            args = args.substring(0, j) + '\\pcell' + args.substring(j+1);
            j = args.indexOf('p', j+2);
          }
          while (args.includes('*')) {
            args = args.replace('*', '\\repeatcell');
          }
          
          latex = latex.substring(0, argsStart) + args + '}{' +latex.substring(argsEnd+1);
          i = argsStart + args.length + 2;
          
          if (depth == 0) {
            firstStart = i;
          }
        } else {
          i = b + 1;
        }
        depth++;
      } else {
        depth--;
        latex = latex.substring(0,e) + '}' + latex.substring(e);

        if (depth == 0 && firstStart) {
          tabularLatex = setTabularMacros(latex.substring(firstStart, e));
          latex = latex.substring(0, firstStart) + tabularLatex + latex.substring(e);
          i = firstStart + tabularLatex.length + 2;
        } else {
          i = e + 2;
        }
      }
    }
    console.log(1, latex);

    const ltx = `\\documentclass{article}

\\usepackage{comment, multicol}
\\usepackage{hyperref}
\\usepackage{calc,pict2e,picture}
\\usepackage{textgreek,textcomp,gensymb,stix}

\\begin{document}

${latex}

\\end{document}`;

    // MAIN PROCESSING
    generator.reset();
    try {
      generator = latexjs.parse(ltx, { generator: generator });
    }
    catch (e) {
      console.log(e);
      // return error
      throw {
        message: e.message,
      }
    }

    let child = generator.domFragment().firstChild;
    
    // POST PROCESSING

    // line break at the end paragraphs
    while (child.innerHTML.includes('<p><br></p>')) {
      child.innerHTML = child.innerHTML.replace('<p><br></p>', '<p>&nbsp;</p>');
    }
    while (child.innerHTML.includes('<br></p>')) {
      child.innerHTML = child.innerHTML.replace('<br></p>', '<br>&nbsp;</p>');
    }

    // remove first parenthesis in alphabetic enumerate
    for (el of child.getElementsByClassName('itemlabel')) {
      el.innerHTML = el.innerHTML.replace('(', '');
    }

    // minipage width inside fbox
    for (minipage of child.getElementsByClassName('minipage')) {
      let parent = minipage.parentElement;
      if (parent.classList.contains('hbox')) {
        if (parent.style.width) {
          parent.style.width = parent.style.width.slice(0, -1) + minipage.style.width + ')';
        }
        else {
          parent.style.width = 'calc(' + minipage.style.width + ')';
        }
        minipage.style.removeProperty('width');
      }
    }

    // tabular
    function applyStyle(elements, property, value) {
      for (el of elements) {
        el.style.setProperty(property, value);
      }
    }

    for (tabular of child.getElementsByClassName('tabular')) {
      let cells = []
          col = 0,
          columns = parseInt(tabular.dataset.columns);
      
      if (columns) {
        while (columns--) cells.push([]);

        for (el of tabular.children) {
          if (el.classList.contains('cell')) {
            if (el.classList.contains('multicolumn')) {
              let c = parseInt(el.dataset.columns);
              el.style.gridColumn = (col+1) + '/' + (col + 1 + c);

              let template = el.dataset.template;
              try {
                if (col == 0 && template.startsWith('||')) {
                  el.style.borderLeft = '4px double black';
                  template = template.substring(2);
                } else if (col == 0 && template.startsWith('|')) {
                  el.style.borderLeft = '1px solid black';
                  template = template.substring(1);
                }
                if (template[0] == 'c') {
                  el.style.textAlign = 'center';
                } else if (template[0] == 'r') {
                  el.style.textAlign = 'right';
                }
                template = template.substring(1);
                if (template == '||') {
                  el.style.borderRight = '4px double black';
                } else if (template == '|') {
                  el.style.borderRight = '1px solid black';
                }
              } catch (e) {
                throw {
                  message: `syntax error: wrong multicolumn argument '${template}'`
                }
              }
              col += c;
            } else {
              cells[col].push(el);

              col++;
              if (col == cells.length) {
                col = 0
              }
            }
          } else {
            col = 0
          }
        }
      
        let template = tabular.dataset.template;
        col = 0;
        for (let i = 0; i < template.length; i++) {
          if (i < template.length - 1 && template[i] == '|' && template[i + 1] == '|') {
            if (i == 0) {
              applyStyle(cells[col], 'border-left', 'double black 4px');
            } else {
              applyStyle(cells[col-1], 'border-right', 'double black 4px');
            }
            i++;
          }
          else if (template[i] == '|') {
            if (i == 0) {
              applyStyle(cells[col], 'border-left', '1px solid black');
            } else {
              applyStyle(cells[col-1], 'border-right', '1px solid black');
            }
          } else {
            if (template[i] == 'c') {
              applyStyle(cells[col], 'text-align', 'center');
            } else if (template[i] == 'r') {
              applyStyle(cells[col], 'text-align', 'right');
            } else if (template[i] == 'p') {
              applyStyle(cells[col], 'text-align', 'justify');
            }
            col++;
          }
        }
      }
    }

    // DISPLAY
    parentElement.innerHTML = '';
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