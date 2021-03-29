const TIKZPICTURE_DEFAULT_WAITING_TIME = 3000;
const TIKZPICTURE_DEFAULT_INTERVAL_TIME = 1500;
const SPACES = [' ', '\n', '\t'];

var _scripts = document.getElementsByTagName('script');
var _path = _scripts[_scripts.length - 1].src.slice(0, -11);

var _latexjsScript = document.createElement('script');
_latexjsScript.src = _path + 'latex.js';
document.head.appendChild(_latexjsScript);

var _basicGenerator = 'basicGenerator';
var _compiledTikz = new Map();

function _fixSVG(svg) {
  var parser = new DOMParser();
  var xmlDoc = parser.parseFromString(svg, 'text/xml');
  var iriElementsAndProperties = {
    clipPath: ['clip-path'],
    'color-profile': ['color-profile'],
    cursor: ['cursor'],
    filter: ['filter'],
    linearGradient: ['fill', 'stroke'],
    marker: ['marker', 'marker-start', 'marker-mid', 'marker-end'],
    mask: ['mask'],
    pattern: ['fill', 'stroke'],
    radialGradient: ['fill', 'stroke'],
  };
  const elementDefs = xmlDoc.querySelectorAll('defs ' + '[id]');
  for (let i = 0; i < elementDefs.length; i++) {
    let def = elementDefs[i];
    let oldId = def.id;
    let newId = _guid();
    def.id = newId;
    const uses = xmlDoc.querySelectorAll(`[*|href="#${oldId}"]`);
    Array.from(uses).forEach((use) => {
      use.setAttribute('xlink:href', '#' + newId);
    });
    Object.keys(iriElementsAndProperties).forEach((elem) => {
      let properties = iriElementsAndProperties[elem];
      properties.forEach((prop) => {
        let referencingElements = xmlDoc.querySelectorAll(
          '[' + prop + '*="' + oldId + '"]'
        );
        Array.from(referencingElements).forEach((refelem) => {
          refelem.setAttribute(prop, `url(#${newId})`);
        });
      });
    });
  }
  return xmlDoc.documentElement.outerHTML;
}

function _guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return (
    s4() +
    s4() +
    '-' +
    s4() +
    '-' +
    s4() +
    '-' +
    s4() +
    '-' +
    s4() +
    s4() +
    s4()
  );
}

function _setTabularMacros(latex) {
  let mathMode = false,
      start = 0,
      string = '';
  for (let i = 0; i < latex.length; i++) {
    if (latex[i] == '$') {
      mathMode = !mathMode;
    }

    if (!mathMode) {
      if (latex.substring(i, i+6) == '\\hline') {
        let trim = string.trim();
        latex = latex.substring(0, start) + trim + '}\\hline{' + latex.substring(i + 6);
        i = start + trim.length + 7; string = ''; start = i+1;
      } else if (latex[i] == '&') {
        let trim = string.trim();
        latex = latex.substring(0, start) + trim + '}\\nextcell{' + latex.substring(i + 1);
        i = start + trim.length + 10; string = ''; start = i+1;
      } else if (i < latex.length - 1 && latex[i] == '\\' && latex[i + 1] == '\\') {
        let trim = string.trim();
        latex = latex.substring(0, start) + trim + '}\\endline{' + latex.substring(i + 2);
        i = start + trim.length + 9; string = ''; start = i+1;
      } else {
        string += latex[i];
      }
    } else {
      string += latex[i];
    }
  }
  latex = latex.substring(0, start) + string.trim();
  return latex;
}

function _createCell(content) {
  if (
    content &&
    content.classList &&
    content.classList.contains('multicolumn')
  ) {
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

function _applyStyle(elements, property, value) {
  for (el of elements) {
    el.style.setProperty(property, value);
  }
}

function _tikzpictureRequest(tikzpicture, id, tikzpictureOptions) {
  let container = document.querySelector(`.ltx #${id}`);

  let formdata = new FormData();
  formdata.append('tikzpicture', tikzpicture);

  var xhr = new XMLHttpRequest();
  xhr.open('POST', tikzpictureOptions.url);

  for ([key, value] of Object.entries(tikzpictureOptions.requestHeaders)) {
    xhr.setRequestHeader(key, value);
  }

  xhr.onreadystatechange = () => {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      if (xhr.status == 200) {
        svg = _fixSVG(xhr.responseText);
        container.innerHTML = svg;
        _compiledTikz.set(tikzpicture, svg);
      } else {
        container.firstChild.classList.remove('loading');
        container.firstChild.src = _path + 'img/error.svg';
        container.firstChild.title = xhr.responseText;
      }
    }
  };

  xhr.send(formdata);

  container.firstChild.src = _path + 'img/loading.svg';
  container.firstChild.classList.add('loading');
  container.firstChild.title = 'loading';
}

function CustomGenerator(customArgs, customPrototype) {
  var generator = new latexjs.HtmlGenerator({
    CustomMacros: (function () {
      var args = (CustomMacros.args = customArgs),
        prototype = (CustomMacros.prototype = customPrototype);

      function CustomMacros(generator) {
        this.g = generator;
      }

      // CUSTOM MACROS

      // minipage
      args['minipage'] = ['V', 'k?', 'k'];
      prototype['minipage'] = function (adjustment, width) {
        let minipage = document.createElement('div');
        minipage.classList.add('minipage');
        if (width.includes('w')) {
          minipage.style.width = parseFloat(width.split('w')[0]) * 100 + '%';
        } else {
          minipage.style.width = width;
        }

        if (adjustment) {
          minipage.classList.add(adjustment);
        }
        return [minipage];
      };

      // fbox
      args['fbox'] = ['V', 'g'];
      prototype['fbox'] = function (content) {
        let fbox = document.createElement('div');
        fbox.classList.add('hbox');
        fbox.classList.add('frame');
        fbox.appendChild(content);
        return [fbox];
      };

      // table
      args['table'] = ['V'];
      prototype['table'] = function () {
        let tabCounter = this.g._counters.get('table');
        if (tabCounter % 1 === 0) {
          this.g._counters.set('table', tabCounter + 0.5);
        }
        this.g._counters.set(
          'figure',
          parseInt(this.g._counters.get('figure'))
        );

        let table = document.createElement('div');
        table.classList.add('table');

        return [table];
      };

      // tabular
      args['tabular'] = ['V', 'g', 'g'];
      prototype['tabular'] = function (template, content) {
        let tabular = document.createElement('div');
        tabular.classList.add('tabular');
        tabular.style.gridTemplateColumns = '';

        if (!template) {
          return [tabular];
        }
        if (template.childNodes.length > 0) {
          template = template.childNodes[0].wholeText;
        } else {
          template = template.data;
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
            let width = columns.substring(i + 2, e);
            if (width.includes('w')) {
              gridTemplateColumns +=
                parseFloat(width.split('w')[0]) * 100 + '%';
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
          template = template.substring(0, b) + template.substring(e + 1);
        }

        tabular.dataset.template = template;
        tabular.appendChild(_createCell(content));
        return [tabular];
      };

      args['repeatcell'] = ['H', 'n', 'g'];
      prototype['repeatcell'] = function (number, column) {
        if (!column) {
          return [];
        }
        return [column.data.repeat(number)];
      };

      args['pcell'] = ['H', 'g'];
      prototype['pcell'] = function (length) {
        if (!length) {
          return [];
        }
        length = length.data;
        return ['p{' + length + '}'];
      };

      // hline
      args['hline'] = ['V', 'g'];
      prototype['hline'] = function (content) {
        return [document.createElement('hr'), _createCell(content)];
      };

      // endline
      args['endline'] = ['V', 'g'];
      prototype['endline'] = function (content) {
        let endline = document.createElement('div');
        endline.classList.add('endline');
        return [endline, _createCell(content)];
      };

      // nextcell
      args['nextcell'] = ['V', 'g'];
      prototype['nextcell'] = function (content) {
        return [_createCell(content)];
      };

      // multicolumn
      args['multicolumn'] = ['V', 'n', 'k', 'g'];
      prototype['multicolumn'] = function (number, template, content) {
        if (!template) {
          throw {
            message: `syntax error: wrong multicolumn argument '${template}'`,
          };
        }

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
      };

      // figure
      args['figure'] = ['V'];
      prototype['figure'] = function () {
        let figCounter = this.g._counters.get('figure');
        if (figCounter % 1 === 0) {
          this.g._counters.set('figure', figCounter + 0.5);
        }
        this.g._counters.set('table', parseInt(this.g._counters.get('table')));

        let figure = document.createElement('div');
        figure.classList.add('figure');

        return [figure];
      };

      // includegraphics
      args['includegraphics'] = ['V', 'kv?', 'u'];
      prototype['includegraphics'] = function (option, url) {
        let img = document.createElement('img');
        img.src = url;

        if (option && option.length > 0) {
          img.style.display = 'none';
          let [prop, val] = Object.entries(option[0])[0];
          if (prop == 'width' || prop == 'height') {
            if (val.includes('w')) {
              val = parseFloat(val.split('w')[0]) * 100 + '%';
            }
            img.style.setProperty(prop, val);
            img.style.removeProperty('display');
          } else if (prop == 'scale') {
            img.onload = function () {
              this.style.width = this.width * val + 'px';
              img.style.removeProperty('display');
            };
          }
        }

        return [img];
      };

      // caption
      args['caption'] = ['V', 'g'];
      prototype['caption'] = function (content) {
        let caption = document.createElement('p');
        caption.classList.add('caption');
        caption.appendChild(content);

        let figCounter = this.g._counters.get('figure'),
          tabCounter = this.g._counters.get('table');
        if (figCounter % 1 !== 0) {
          caption.dataset.number = Math.ceil(figCounter);
          this.g._counters.set('figure', figCounter + 1);
        } else if (tabCounter % 1 !== 0) {
          caption.dataset.number = Math.ceil(tabCounter);
          this.g._counters.set('table', tabCounter + 1);
        }

        return [caption];
      };

      // tikzpicture
      args['tikzpicture'] = ['V'];
      prototype['tikzpicture'] = function () {
        let container = document.createElement('div');
        container.classList.add('tikzpicture');

        let number = this.g.timeouts.length,
            skipTime = this.g.timeouts.filter(tm => !tm).length;
        let tickzpicture = this.g.tikzpictures[number],
          id = `tikzpicture-${number}`;
        if (_compiledTikz.has(tickzpicture)) {
          this.g.timeouts.push(null);
          container.innerHTML = _compiledTikz.get(tickzpicture);
          return [container];
        }

        if (!this.g.tikzpictureOptions.url) {
          let errorImg = document.createElement('img');
          errorImg.classList.add('tikzpicture');
          errorImg.src = _path + 'img/error.svg';

          container.appendChild(errorImg);
          return [container];
        }

        let waitingTime =
          this.g.tikzpictureOptions.waitingTime +
          (number - skipTime) * this.g.tikzpictureOptions.intervalTime;

        let tm = setTimeout(
          _tikzpictureRequest,
          waitingTime,
          tickzpicture,
          id,
          this.g.tikzpictureOptions
        );
        this.g.timeouts.push(tm);

        let waitingImg = document.createElement('img');
        waitingImg.src = _path + 'img/waiting.svg';
        waitingImg.title = `waiting (${waitingTime / 1000}s without writing)`;

        container.id = id;
        container.appendChild(waitingImg);
        return [container];
      };

      return CustomMacros;
    })(),
  });
  generator.tikzpictures = [];
  generator.timeouts = [];
  return generator;
}

function _removeArgs(latex, command) {
  while (latex.includes(command + '{') || latex.includes(command + '[')) {
    let i =
      latex.indexOf(command + '{') > -1
        ? latex.indexOf(command + '{')
        : latex.indexOf(command + '[');
    let end = latex.indexOf(command + '{') > -1 ? '}' : ']';
    let e = latex.indexOf(end, i + command.length),
      endOfLine = latex.indexOf('\n', i + command.length);
    if (e == -1 || e > endOfLine) {
      throw {
        message: `syntax error: missing end of arguments '${end}'`,
      };
    }
    latex = latex.substring(0, i + command.length) + latex.substring(e + 1);
  }
  return latex;
}

function ltxclean(latex) {
  // GOAL: remove arguments that cannot be processed

  // clean enumerate
  latex = _removeArgs(latex, '\\begin{enumerate}');

  // textwidth
  while (latex.includes('\\textwidth')) {
    latex = latex.replace('\\textwidth', '\\linewidth');
  }

  // figure
  latex = _removeArgs(latex, '\\begin{figure}');

  // table
  latex = _removeArgs(latex, '\\begin{table}');

  return latex;
}

function _preprocess(latex, generator) {
  // itemize
  let i = 0,
    labelStack = [];
  while (
    latex.includes('\\begin{itemize}', i) ||
    latex.includes('\\end{itemize}', i) ||
    (latex.includes('\\item ', i) && labelStack.length > 0)
  ) {
    let b = latex.indexOf('\\begin{itemize}', i),
        e = latex.indexOf('\\end{itemize}', i),
        t = labelStack.length > 0 ? latex.indexOf('\\item ', i) : -1;
    if (b > -1 &&
        ((e > -1 && t > -1 && b < e && b < t) ||
        (e > -1 && t == -1 && b < e) ||
        (e == -1 && t > - 1 && b < t) ||
        (e == -1 && t == -1))) {
      labelStack.push(null);
      if (latex.indexOf('\\begin{itemize}[', i) == b) {
        let argsStart = latex.indexOf('[', b) + 1,
            argsEnd = latex.indexOf(']', b);
        let args = latex.substring(argsStart, argsEnd);
        if (args.startsWith('label=')) {
          labelStack[labelStack.length - 1] = args.substring(6);
          latex = latex.substring(0, argsStart - 1) + latex.substring(argsEnd + 1); 
        }
      }
      i = b + 1;
    } else if (e > 1 &&
      ((b > -1 && t > -1 && e < b && e < t) ||
        (b > -1 && t == -1 && e < b) ||
        (b == -1 && t > - 1 && e < t) ||
        (b == -1 && t == -1))) {
      labelStack.pop();
      i = e + 1;
    } else {
      let label = labelStack[labelStack.length - 1];
      if (label != null && latex.indexOf('\\item[', i) != t) {
        latex = latex.substring(0, t) + `\\item[${label}]` + latex.substring(t+5);
      }
      i = t + 1;
    }
  }

  // tikzpicture
  i = 0;
  let depth = 0,
      tikzpictureStart;
  while (
    latex.includes('\\begin{tikzpicture}', i) ||
    latex.includes('\\end{tikzpicture}', i)
  ) {
    let b = latex.indexOf('\\begin{tikzpicture}', i),
        e = latex.indexOf('\\end{tikzpicture}', i);
    if (b > -1 && ((e > -1 && b < e) || e == -1)) {
      if (depth == 0) {
        tikzpictureStart = b;
        depth++;
        i = b + 1;
      } else {
        throw {
          message: 'nested tikzpicture environments are not allowed',
        };
      }
    } else {
      if (depth == 1) {
        tikzpicture = latex.substring(tikzpictureStart, e + 17);
        generator.tikzpictures.push(tikzpicture);

        latex =
          latex.substring(0, tikzpictureStart) +
          '\\tikzpicture' +
          latex.substring(e + 17);

        depth--;
        i = tikzpictureStart;
      } else {
        throw {
          message: "environment 'tikzpicture' beginning is missing",
        };
      }
    }
  }
  if (depth > 0) {
    throw {
      message: "environment 'tikzpicture' is missing its end",
    };
  }

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
  // textwidth
  while (latex.includes('\\textwidth')) {
    latex = latex.replace('\\textwidth', 'w');
  }

  // tabular
  i = 0;
  depth = 0;
  let firstStart;
  while (
    latex.includes('\\begin{tabular}', i) ||
    latex.includes('\\end{tabular}', i)
  ) {
    let b = latex.indexOf('\\begin{tabular}', i),
        e = latex.indexOf('\\end{tabular}', i);
    if (b > -1 && ((e > -1 && b < e) || e == -1)) {
      if (latex.indexOf('\\begin{tabular}{', i) == b) {
        let argsStart = latex.indexOf('}{', b) + 2;
        let argsEnd = argsStart,
          stack = 0;
        while ((stack > 0 || latex[argsEnd] != '}') && argsEnd < latex.length) {
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
          args = args.substring(0, j) + '\\pcell' + args.substring(j + 1);
          j = args.indexOf('p', j + 2);
        }
        while (args.includes('*')) {
          args = args.replace('*', '\\repeatcell');
        }

        latex =
          latex.substring(0, argsStart) +
          args +
          '}{' +
          latex.substring(argsEnd + 1);
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
      latex = latex.substring(0, e) + '}' + latex.substring(e);

      if (depth == 0 && firstStart) {
        tabularLatex = _setTabularMacros(latex.substring(firstStart, e));
        latex =
          latex.substring(0, firstStart) + tabularLatex + latex.substring(e);
        i = firstStart + tabularLatex.length + 2;
      } else {
        i = e + 2;
      }
    }
  }
  return latex;
}

function _postprocess(body) {
  // line break at the end paragraphs
  while (body.innerHTML.includes('<p><br></p>')) {
    body.innerHTML = body.innerHTML.replace('<p><br></p>', '<p>&nbsp;</p>');
  }
  while (body.innerHTML.includes('<br></p>')) {
    body.innerHTML = body.innerHTML.replace('<br></p>', '<br>&nbsp;</p>');
  }

  // minipage width inside fbox
  for (minipage of body.getElementsByClassName('minipage')) {
    let parent = minipage.parentElement;
    if (parent.classList.contains('hbox')) {
      if (parent.style.width) {
        parent.style.width =
          parent.style.width.slice(0, -1) + minipage.style.width + ')';
      } else {
        parent.style.width = 'calc(' + minipage.style.width + ')';
      }
      minipage.style.removeProperty('width');
    }
  }

  // tabular
  for (tabular of body.getElementsByClassName('tabular')) {
    let cells = [];
    (col = 0), (columns = parseInt(tabular.dataset.columns));

    if (columns) {
      while (columns--) cells.push([]);

      for (el of tabular.children) {
        if (el.classList.contains('cell')) {
          if (el.classList.contains('multicolumn')) {
            let c = parseInt(el.dataset.columns);
            el.style.gridColumn = col + 1 + '/' + (col + 1 + c);

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
                message: `syntax error: wrong multicolumn argument '${template}'`,
              };
            }
            col += c;
          } else {
            cells[col].push(el);

            col++;
            if (col == cells.length) {
              col = 0;
            }
          }
        } else {
          col = 0;
        }
      }

      let template = tabular.dataset.template;
      col = 0;
      for (let i = 0; i < template.length; i++) {
        if (
          i < template.length - 1 &&
          template[i] == '|' &&
          template[i + 1] == '|'
        ) {
          if (i == 0) {
            _applyStyle(cells[col], 'border-left', 'double black 4px');
          } else {
            _applyStyle(cells[col - 1], 'border-right', 'double black 4px');
          }
          i++;
        } else if (template[i] == '|') {
          if (i == 0) {
            _applyStyle(cells[col], 'border-left', '1px solid black');
          } else {
            _applyStyle(cells[col - 1], 'border-right', '1px solid black');
          }
        } else {
          if (template[i] == 'c') {
            _applyStyle(cells[col], 'text-align', 'center');
          } else if (template[i] == 'r') {
            _applyStyle(cells[col], 'text-align', 'right');
          } else if (template[i] == 'p') {
            _applyStyle(cells[col], 'text-align', 'justify');
          }
          col++;
        }
      }
    }
  }
}

function _autoresizeTabulars() {
  let tabs = document.querySelectorAll('.ltx .tabular');

  for (tab of tabs) {
    tab.style.removeProperty('transform');
    tab.style.removeProperty('height');
    let tabWidth = parseFloat(window.getComputedStyle(tab).width),
        parentWidth = parseFloat(window.getComputedStyle(tab.parentNode).width);
    if (tabWidth > parentWidth) {
      let scale = parentWidth / tabWidth;
      tab.style.transform = `scale(${scale})`;
      let tabHeight = parseFloat(window.getComputedStyle(tab).height);
      tab.style.height = tabHeight * scale + 'px';
    }
  }
}
window.addEventListener('resize', _autoresizeTabulars);

function ltx2html(
  latex,
  parentElement,
  options = {}
) {
  // DEFAULT VALUES
  if (!options.tikzpicture) {
    options.tikzpicture = {
      url: '',
      waitingTime: TIKZPICTURE_DEFAULT_WAITING_TIME,
      intervalTime: TIKZPICTURE_DEFAULT_INTERVAL_TIME,
      requestHeaders: {},
    }
  } else {
    if (!options.tikzpicture.waitingTime) {
      options.tikzpicture.waitingTime = TIKZPICTURE_DEFAULT_WAITING_TIME;
    }
    if (!options.tikzpicture.intervalTime) {
      options.tikzpicture.intervalTime = TIKZPICTURE_DEFAULT_INTERVAL_TIME;
    }
    if (!options.tikzpicture.requestHeaders) {
      options.tikzpicture.requestHeaders = {};
    }
  }

  let generator = options.generator;
  if (!generator) {
    generator = _basicGenerator;
  }

  if (generator == 'basicGenerator') {
    _latexjsScript.addEventListener('load', function () {
      ltx2html(latex, parentElement);
    });
  } else {
    // RESET GENERATOR
    generator.reset();
    for (tm of generator.timeouts) {
      clearTimeout(tm);
    }
    generator.timeouts = [];
    generator.tikzpictures = [];
    generator.tikzpictureOptions = options.tikzpicture;

    // CLEAN
    latex = ltxclean(latex);

    // PRE PROCESSING
    latex = _preprocess(latex, generator);

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
    } catch (e) {
      console.log(e);
      // return error
      throw {
        message: e.message,
      };
    }

    let body = generator.domFragment().firstChild;

    // POST PROCESSING
    _postprocess(body)
    
    // DISPLAY
    parentElement.innerHTML = '';
    if (!parentElement.classList.contains('ltx')) {
      parentElement.classList.add('ltx');
    }
    if (options.noindent != undefined && parentElement.classList.contains('noindent') != options.noindent) {
      if (options.noindent) {
        parentElement.classList.add('noindent');
      } else {
        parentElement.classList.remove('noindent');
      }
    }
    parentElement.appendChild(body);

    // auto resize tabulars
    setTimeout(_autoresizeTabulars, 50);
  }
}

_latexjsScript.addEventListener('load', function () {
  _basicGenerator = CustomGenerator({}, {});
  _basicGenerator = latexjs.parse(
    '\\documentclass{article}\n\\begin{document}\n\\end{document}',
    { generator: _basicGenerator }
  );
  document.head.appendChild(_basicGenerator.stylesAndScripts(_path));
});
