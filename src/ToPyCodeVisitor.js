'use strict'

class ToPyCodeVisitor {

  constructor() {
    this.DEFAULT_INDENT = '  '
    this.indent = ''
  }

  indentInc() {
    return this.indent + this.DEFAULT_INDENT
  }

  indentDec() {
    return this.indent.substring(0, this.indent.length - this.DEFAULT_INDENT.length)
  }

  indentIncSet() {
    this.indent = this.indentInc()
  }

  indentDecSet() {
    this.indent = this.indentDec()
  } 

  leaveSuper(node) {
    node.text = 'super()'
  }

  leaveIdentifier(node) {
    node.text = node.name
  }

  leaveLiteral(node) {
    node.text = node.value === null ? 'None' : node.raw
  }

  leaveThisExpression(node) {
    node.text = 'self'
  }

  leaveArrayPattern(node) {
    const elems = node.elements.map(e => e.text) 
    node.text = `[${elems.join(', ')}]`
  }

  leaveProperty(node) {
    node.text = `'${node.key.text}': ${node.value.text}`
  }

  enterObjectExpression(node) {
    this.indentIncSet()
  }

  leaveObjectExpression(node) {
    if (node.properties.length === 0) {
      node.text = '{}'
      return
    } 

    const properties = node.properties.map(p => p.text)
    node.text = `{\n${this.indent}${properties.join(`,\n${this.indent}`)}\n${this.indentDec()}}`
    this.indentDecSet()
  }

  leaveArrayExpression(node) {
    const elems = node.elements.map(e => e.text)
    node.text = `[${elems.join(', ')}]`
  }

  leaveAssignmentPattern(node) {
    node.text = `${node.left.text} = ${node.right.text}`
  }

  enterClassBody(node) {
    this.indentIncSet()
  }
  leaveClassBody(node) {
    const stmts = node.body.map(e => e.text)
    if (stmts.length === 0) {
      node.text = `${this.indent}pass\n`
      return
    }
    node.text = this.indent + stmts.join(`\n${this.indent}`) + '\n'
    this.indentDecSet()
  }

  enterBlockStatement(node) {
    this.indentIncSet()
  }
  leaveBlockStatement(node) {
    const stmts = node.body.map(e => e.text)
    if (stmts.length === 0) {
      node.text = `${this.indent}pass`
    } else {
      node.text = this.indent + stmts.join(`\n${this.indent}`)
    }
    this.indentDecSet()
  }

  leaveMethodDefinition(node) {
    const NL_AFTER_METHOD = '\n'
    const isConstructor = node.kind === 'constructor'
    const methodName = isConstructor ? '__init__' : node.key.text
    const selfAndParams = [{text: 'self'}].concat(node.value.params)
    const params = selfAndParams.map(p => p.text).join(', ')
    node.text = `def ${methodName}(${params}):\n${node.value.body.text}${NL_AFTER_METHOD}`
  }

  leaveFunctionDeclaration(node) {
    const functionName = node.id ? node.id.text : '' 
    const params = node.params.map(p => p.text).join(', ')
    node.text = `def ${functionName}(${params}):\n${node.body.text}\n`
  }

  leaveClassDeclaration(n) {
    const superClass = n.superClass ? `(${n.superClass.text})` : ''
    n.text = `class ${n.id.text}${superClass}:
${n.body.text}`
  }

  leaveExpressionStatement(ast) {
    ast.text = ast.expression.text
  }

  leaveUnaryExpression(node) {
    const operators = {
      'delete': 'del ',
      'void': '??',
      'typeof': '??',
      '+': '+',
      '-': '-',
      '~': '??',
      '!': 'not '
    }
    node.text = `${operators[node.operator]}${node.argument.text}`
  }

  leaveBinaryExpression(node) {
    const left = node.left.type === 'BinaryExpression' ? `(${node.left.text})` : node.left.text
    const right = node.right.type === 'BinaryExpression' ? `(${node.right.text})` : node.right.text
    const operator = node.operator === '===' ? '==' : node.operator    
    node.text = `${left} ${operator} ${right}`
  }

  leaveForStatement(node) {
    const forInRange = 'for (var _1 = 0; _2 < _3; _4++) _5'
    const asForInRange = false ||
      (node.init.type === 'VariableDeclaration' && node.init.declarations.length === 1) &&
      ((node.update.type === 'UpdateExpression' && node.update.operator === '++') ||
      (node.update.type === 'AssignmentExpression' && node.update.operator === '+=')) &&
      (node.test.type === 'BinaryExpression')

    if (asForInRange) {
      const id = node.init.declarations[0].id.name
      const low = node.init.declarations[0].init.text
      const high = node.test.right.text
      node.text = `for ${id} in range(${low}, ${high}):\n${node.body.text}`
      return
    } else {
      const init = node.init.text
      const test = node.test.text
      const update = node.update.text
      const body = node.body.text
      node.text = `${init}
${this.indent}while ${test}:
${this.indent}${body}
${this.indentInc()}${update}`
      return
    }
  }

  leaveIfStatement(node) {
    const optionalAlternate = node.alternate ? `\n${this.indent}else:\n${this.indent}${node.alternate.text}` : ''
    
    node.text = `if ${node.test.text}:
${this.indent}${node.consequent.text}${optionalAlternate}`
  }

  leaveCallExpression(node) {
    const args = node.arguments.map(arg => arg.text)
    const callee = `${node.callee.text}${node.callee.type === 'Super' ? '.__init__' : ''}`
    node.text = `${callee}(${args.join(', ')})`
  }

  leaveMemberExpression(node) {
    if (typeof node.property.value == 'number') { // TODO fix poor type quessing
      node.text =  `${node.object.text}[${node.property.text}]`
    } else {
      node.text = `${node.object.text}.${node.property.text}`
    }
  }

  leaveNewExpression(node) {
    const args = node.arguments.map(arg => arg.text)
    node.text = `${node.callee.text}(${args.join(', ')})`
  }

  leaveAssignmentExpression(node) {
    node.text = `${node.left.text} ${node.operator} ${node.right.text}`    
  }

  leaveVariableDeclarator(node) {
    node.text = node.init ? `${node.id.text} = ${node.init.text}` : ''
  }

  leaveTemplateLiteral(node) {
    const fmtString = "'" + node.quasis.map(q => q.value.raw).join('%f') + "'" // TODO infer type
    const exprs = node.expressions.map(expr => expr.text).join(', ')
    node.text = exprs.length === 0 ? fmtString : `${fmtString} % (${exprs})` 
  }

  leaveVariableDeclaration(node) {
    const decls = node.declarations.map(e => e.text)
    node.text = decls.join('\n')
  }

  leaveReturnStatement(node) {
    node.text = `return${node.argument ? ' '+node.argument.text:''}`
  }

  leaveProgram(node) { 
    node.text = node.body.map(e => e.text).join('\n')
  }
}

module.exports = ToPyCodeVisitor
