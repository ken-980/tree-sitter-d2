/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// FIXME: This will be refactored after fixing grammar's edge cases.
const PREC = {
  terminate: 1000,
  comment: 900,

  visibility_mark: 850,

  escape: 800,
  string: 500,

  variable: 100,

  colon_start: 80,

  ident_fix: 51,

  connection: 10,
  glob: 8,

  block: 5,

  identifier: 3,

  label_codeblock: 3,
  label_array: 3,
  label_predefined: 2,
  label: 1,
};

/**
 * Shortcut for optional(seq(...rules))
 *
 * @param {...RuleOrLiteral} rules
 * @returns {ChoiceRule}
 */
const opseq = (...rules) => optional(seq(...rules));

/**
 * Shortcut for repeat(seq(...rules))
 *
 * @param {...RuleOrLiteral} rules
 * @returns {RepeatRule}
 */
// const rseq = (...rules) => repeat(seq(...rules));

/**
 * Shortcut for repeat1(seq(...rules))
 *
 * @param {...RuleOrLiteral} rules
 * @returns {Repeat1Rule}
 */
const r1seq = (...rules) => repeat1(seq(...rules));

/**
 * Creates a rule to match one or more occurrences of `rule` separated by
 * `separator`.
 *
 * @param {RuleOrLiteral} rule
 * @param {RuleOrLiteral} separator
 * @returns {SeqRule}
 */
const repeat_sep = (rule, separator) => seq(rule, repeat(seq(separator, rule)));

/**
 * Creates a special rule for labels and identifiers, because can be pretty
 * much every character _including_ spaces, which makes it difficult to parse
 * with a simple set of rules or regexes.
 *
 * @param {RuleOrLiteral} rule
 */

const spaced_str = (rule) =>
  choice(rule, seq(repeat1(seq(rule, /[ ]+/)), rule));

/**
 * Creates a rule to match at least 2 occurrences of `rule` separated by
 * `separator`.
 *
 * @param {RuleOrLiteral} rule
 * @param {RuleOrLiteral} separator
 * @returns {SeqRule}
 */
const sep1 = (rule, separator) => seq(rule, repeat1(seq(separator, rule)));

module.exports = grammar({
  name: "d2",

  // word: $ => $._ident_base,

  extras: ($) => [$.comment, $.block_comment, $._eol, /\s/],

  conflicts: ($) => [[$._single_top_level_identifier, $._ident_base]],

  rules: {
    source_file: ($) =>
      repeat(prec.left(choice($._declaration, $.comment, $.block_comment))),

    comment: (_) => token(seq("#", repeat(/./), /\n/)),
    block_comment: (_) =>
      seq('"""', repeat(choice(/[^"]/, /"[^"]/, /""[^"]/)), '"""'),

    _declaration: ($) =>
      choice($.declaration, $.import, $._variable, $.method_declaration),

    declaration: ($) =>
      prec.right(
        -1,
        seq(
          $._expr,
          optional(
            choice(
              seq(token(":"), $.import),
              seq(token(":"), optional($.label), optional($.block))
            )
          ),
          optional($._eol)
        )
      ),

    _expr: ($) => sep($._identifier, $.connection),

    method_declaration: ($) =>
      prec.right(
        100,
        seq(
          $.identifier,
          "(",
          optional($.arguments),
          ")",
          opseq(token(":"), token("("), optional($.returns), token(")"))
        )
      ),

    returns: ($) => alias($.arguments, "returns"),
    arguments: ($) =>
      choice(
        // arg type
        seq($.argument_name, $.argument_type),
        // arg type, arg type
        seq(
          $.argument_name,
          $.argument_type,
          r1seq(",", $.argument_name, $.argument_type)
        ),
        // arg1, arg2 type1, arg3, arg4 type2
        r1seq(
          $.argument_name,
          r1seq(",", $.argument_name),
          $.argument_type,
          optional(",")
        )
      ),

    argument_name: (_) => token(/[a-zA-Z0-9_]+/),
    argument_type: (_) => token(/[a-zA-Z0-9_\[\]]+/),

    connection: (_) =>
      token(prec(PREC.connection, choice(/<-+>/, /<-+/, /-+>/, /--+/))),

    import: (_) =>
      token(prec(PREC.import, seq(choice("@", "...@"), repeat1(/[^\s]/)))),

    block: ($) =>
      prec(
        PREC.block,
        seq(token(prec(PREC.block, "{")), repeat($._declaration), token("}"))
      ),

    label: ($) =>
      choice($.label_codeblock, $._label_constraints, $._label_literal),

    label_codeblock: ($) =>
      choice(
        $._label_codeblock_ticks,
        $._label_codeblock_triple,
        $._label_codeblock_double,
        $._label_codeblock_single
      ),

    _label_codeblock_ticks: ($) =>
      seq(
        token(prec(PREC.label_array, "|`")),
        $.codeblock_language,
        alias(/[^`]*/, $.codeblock_content),
        token(prec(PREC.label_array, "`|"))
      ),

    _label_codeblock_triple: ($) =>
      seq(
        token(prec(PREC.label_codeblock, "|||")),
        $.codeblock_language,
        $.codeblock_content,
        token(prec(PREC.label_codeblock, "|||"))
      ),

    _label_codeblock_double: ($) =>
      seq(
        token(prec(PREC.label_codeblock, "||")),
        $.codeblock_language,
        $.codeblock_content,
        token(prec(PREC.label_codeblock, "||"))
      ),

    _label_codeblock_single: ($) =>
      seq(
        token(prec(PREC.label_codeblock, "|")),
        $.codeblock_language,
        alias(/[^\|]*/, $.codeblock_content),
        token(prec(PREC.label_codeblock, "|"))
      ),

    codeblock_language: (_) => token(/[a-zA-Z0-9]+/),
    codeblock_content: (_) => repeat1(seq(/.+/, /\s*/)),

    _label_constraints: ($) =>
      seq(
        token(prec(PREC.label_array, "[")),
        repeat1(seq($.label_array, optional(";"))),
        token(prec(PREC.label_array, "]"))
      ),

    label_array: ($) => choice(token(/[a-zA-Z0-9_]+/), $._variable),

    _label_literal: ($) =>
      choice(
        $.integer,
        $.float,
        $.boolean,
        $._label_double_quoted,
        $._single_quoted,
        $._label_base
      ),

    _label_base: ($) =>
      prec.left(
        PREC.label,
        repeat1(
          choice(
            $.escape,
            "*",
            token.immediate(/[^\n;\\\{\}\[\]]+/),
            $._variable
          )
        )
      ),

    _label_double_quoted: ($) =>
      seq(
        token(prec(PREC.string, '"')),
        repeat(
          choice(token.immediate(prec(1, /[^"\n\\$]+/)), $.escape, $._variable)
        ),
        token(prec(PREC.string, '"'))
      ),

    _identifier: ($) =>
      prec.right(choice($.identifier_chain, $._single_top_level_identifier)),

    identifier_chain: ($) =>
      prec.right(sep1($._single_top_level_identifier, token("."))),

    _single_top_level_identifier: ($) =>
      choice(
        $.glob,
        $.recursive_glob,
        $.global_glob,
        $.identifier,
        $.connection_reference
      ),

    connection_reference: ($) =>
      seq(token("("), $._expr, ")", $.connection_identifier),

    connection_identifier: ($) =>
      seq(token("["), choice(/\d+/, $.glob), token("]")),

    identifier: ($) =>
      prec.right(
        seq(
          optional($._filters),
          choice($._ident, $._single_quoted, $._double_quoted)
        )
      ),

    _fields: ($) => r1seq(".", field("field", $.identifier)),

    _ident: ($) =>
      prec.right(
        r1seq(
          $._ident_base,
          optional(
            choice(token.immediate(prec(PREC.ident_fix, "'")), /[\s,]+/, "\\.")
          )
        )
      ),

    _ident_base: ($) => choice($.glob, "\\*", /([\p{L}\d\/_+\-]|\\#)+/u),

    identifier_escape: (_) =>
      token.immediate(seq("\\", choice("n", "{", "}", ";", "[", "]"))),

    glob: (_) => prec(PREC.glob, token("*")),
    recursive_glob: (_) => prec(PREC.glob, token("**")),
    global_glob: (_) => prec(PREC.glob, token("***")),

    _filters: ($) => choice($.glob_filter, $.inverse_glob_filter),
    glob_filter: (_) => token("&"),
    inverse_glob_filter: (_) => token("!&"),

    _variable: ($) => choice($.variable, $.spread_variable),

    variable: ($) => seq(token("$"), token("{"), $._identifier, token("}")),

    spread_variable: ($) =>
      seq(token("...$"), token("{"), $._identifier, token("}")),

    _single_quoted: ($) =>
      seq(
        token(prec(PREC.string, "'")),
        repeat(
          choice(token.immediate(prec(1, /[^'\n\\]+/)), $.escape_sequence)
        ),
        token(prec(PREC.string, "'"))
      ),
    _double_quoted: ($) =>
      seq(
        token('"'),
        repeat(
          choice(token.immediate(prec(1, /[^"\n\\]+/)), $.escape_sequence)
        ),
        token('"')
      ),

    escape_sequence: (_) =>
      token.immediate(
        seq(
          "\\",
          choice(
            /[^xuU]/,
            /\d{2,3}/,
            /x[0-9a-fA-F]{2,}/,
            /u[0-9a-fA-F]{4}/,
            /U[0-9a-fA-F]{8}/
          )
        )
      ),

    escape: (_) =>
      token.immediate(
        seq(
          "\\",
          choice(
            /[^xuU]/,
            /\d{2,3}/,
            /x[0-9a-fA-F]{2,}/,
            /u[0-9a-fA-F]{4}/,
            /U[0-9a-fA-F]{8}/
          )
        )
      ),

    // We need extra space in the end to make sure it's not a string starting
    // with an integer.
    integer: (_) => token(prec(PREC.label_predefined, /[\-+]?\d+?\s+/)),
    float: (_) => token(prec(PREC.label_predefined, /[\-+]?\d+(\.\d+)?\s+/)),
    boolean: (_) => token(prec(PREC.label_predefined, choice("true", "false"))),

    _eol: (_) => token(prec(PREC.term, choice(/\n/, /\r/, ";"))),
    _eol_or_space: ($) => choice($._eol, repeat(/\s/)),
  },
});
