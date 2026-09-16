/**
 * Ready-made starting points a client can offer before the visitor has
 * thought of a question. Claude Code lists them as `/paprikaf:overview` and
 * `/paprikaf:check_fit`, and Claude shows them from the connector's menu.
 *
 * Neither prompt takes arguments. Claude Code splits prompt arguments on
 * whitespace, so a job description passed as an argument would arrive as its
 * first word. `check_fit` asks for the role in the next message instead.
 */

export type PromptDefinition = {
  name: string;
  title: string;
  description: string;
  text: string;
};

export const PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    name: 'overview',
    title: 'Overview of Ahmed’s work',
    description:
      'A sourced summary of what Ahmed Felfel has built and contributed to, and what the evidence does not show.',
    text: [
      'Using the paprikaf tools, give me an overview of Ahmed Felfel’s public work.',
      'Call get_profile first. For each project, say what he built or',
      'contributed, where it stands today, and link the public source.',
      'Finish with what this evidence does not show. Treat missing evidence as',
      'unknown, not as missing experience.',
    ].join(' '),
  },
  {
    name: 'check_fit',
    title: 'Check a role against Ahmed’s work',
    description:
      'Paste a public job description in your next message and get a sourced comparison with Ahmed’s published work.',
    text: [
      'I’m going to paste a public job description in my next message. When I',
      'do, run the paprikaf compare_role tool on the full text. Then give me',
      'the requirements Ahmed’s public work lines up with, with source links;',
      'the requirements this evidence can’t answer; and the three interview',
      'questions it suggests. Don’t add a hiring recommendation or a score.',
      'Reply now only to ask me for the job description.',
    ].join(' '),
  },
];

export function findPrompt(name: string): PromptDefinition | undefined {
  return PROMPT_DEFINITIONS.find((prompt) => prompt.name === name);
}
