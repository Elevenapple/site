export type PortfolioLink = {
  label: string;
  href: string;
};

export type Project = {
  id: string;
  ownership: string;
  organization: string;
  title: string;
  summary: string;
  tags: string[];
  links: PortfolioLink[];
};

export type Experience = {
  company: string;
  period: string;
  title: string;
  roleProgression?: string[];
  summary: string;
};

export const projects: Project[] = [
  {
    id: 'academy',
    ownership: 'Built',
    organization: 'Builder.io',
    title: 'Builder Academy',
    summary:
      'I built Builder Academy and owned its application engineering from the start, including learner progress and integrations. Enablement and content teammates contributed later. A broader team maintains it today.',
    tags: ['Learning platform', 'Onboarding + certification', 'Live product'],
    links: [{ label: 'Visit Academy', href: 'https://academy.builder.io' }],
  },
  {
    id: 'mcp',
    ownership: 'Built',
    organization: 'Builder.io',
    title: 'Builder CMS MCP Server',
    summary:
      'Builder’s MCP server lets AI clients inspect models and create or update CMS content. I built and launched the first production version. A broader team owns it now.',
    tags: ['MCP', 'Content APIs', 'Agent tooling'],
    links: [
      {
        label: 'Read the public docs',
        href: 'https://www.builder.io/c/docs/mcp-builder-server',
      },
    ],
  },
  {
    id: 'operational-ai',
    ownership: 'Current work',
    organization: 'Builder.io',
    title: 'Internal AI tools for GTM',
    summary:
      'I build internal AI tools for Builder’s GTM team and own the work from prototype through live testing.',
    tags: ['Applied AI', 'Internal tools', 'Live testing'],
    links: [],
  },
  {
    id: 'agent-native',
    ownership: 'Contributor',
    organization: 'Open source',
    title: 'Agent Native',
    summary:
      'I’ve contributed to Builder’s Agent Native across approval flows, meeting capture and history, OAuth URL detection, and org role controls.',
    tags: ['Agent frameworks', 'Product contribution', 'Open source'],
    links: [
      {
        label: 'View merged contributions',
        href: 'https://github.com/BuilderIO/agent-native/pulls?q=is%3Apr+is%3Amerged+author%3Apaprikaf',
      },
    ],
  },
  {
    id: 'discogs-sdk',
    ownership: 'Creator + maintainer',
    organization: 'Open source',
    title: '@crate.ai/discogs-sdk',
    summary:
      'I created and maintain a TypeScript SDK for the Discogs API. It supports OAuth, search, collections, and identity.',
    tags: ['TypeScript SDK', 'OAuth', 'API design'],
    links: [
      {
        label: 'View on npm',
        href: 'https://www.npmjs.com/package/@crate.ai/discogs-sdk',
      },
      {
        label: 'View source',
        href: 'https://github.com/Crate-AI/discogs-sdk',
      },
    ],
  },
  {
    id: 'nomad',
    ownership: 'Building',
    organization: 'Open source',
    title: 'Nomad',
    summary:
      'I’m building Nomad for people who live across borders — travel history against visa and tax-day clocks, with an agent on the same record. Built on Agent Native. Not legal or tax advice.',
    tags: ['Residency', 'Tax presence', 'Agent-native'],
    links: [
      {
        label: 'View on GitHub',
        href: 'https://github.com/paprikaf/nomad',
      },
      {
        label: 'Open community page',
        href: 'https://www.agent-native.com/apps/community/nomad/',
      },
    ],
  },
  {
    id: 'galite',
    ownership: 'Building',
    organization: 'Independent',
    title: 'Galite',
    summary:
      'I’m building an early product for organizing meeting notes, decisions, and follow-ups.',
    tags: ['Early stage', 'Agent-native', 'Personal systems'],
    links: [{ label: 'Open Galite', href: 'https://galite.ai/' }],
  },
];

export const experience: Experience[] = [
  {
    company: 'Builder.io',
    period: '2023—Now',
    title: 'GTM Engineer',
    roleProgression: [
      'Customer Engineer',
      'Partner Enablement Engineer',
      'GTM Engineer',
    ],
    summary:
      'Worked directly with customers, built Builder Academy and the first production Builder CMS MCP server, and now build internal AI tools for GTM.',
  },
  {
    company: 'Appnovation',
    period: '2021—2023',
    title: 'Full-Stack Developer',
    summary:
      'Built React and Electron applications and shared design-system tooling with TypeScript, Contentful, and GCP.',
  },
  {
    company: 'Jesta I.S.',
    period: '2019—2021',
    title: 'Web Developer',
    summary:
      'Built enterprise retail software and worked with product and design on business-critical workflows.',
  },
];

export const expertise = [
  {
    number: '01',
    title: '0→1 product engineering',
    description:
      'Scope and build the first useful version, then improve it from real use.',
  },
  {
    number: '02',
    title: 'AI systems',
    description:
      'Design agent workflows around orchestration, authoritative context, evaluation, human review, and recovery.',
  },
  {
    number: '03',
    title: 'Production systems',
    description: 'Add logging, recovery, and evaluation to the systems I ship.',
  },
  {
    number: '04',
    title: 'Turning customer problems into products',
    description:
      'Turn repeated customer problems into reusable software instead of one-off fixes.',
  },
];

export const publicLinks = {
  email: 'mailto:ahmed@galite.ai',
  github: 'https://github.com/paprikaf',
  linkedin: 'https://www.linkedin.com/in/ahmed-felfel-080895/',
};
