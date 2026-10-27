import { parseEnv } from 'node:util';

export const parseMailboxEnvironment = text => parseEnv(text);

export const literalComposeEnvironment = environment => Object.fromEntries(
  Object.entries(environment).map(([key, value]) => [key, value.replaceAll('$', () => '$$')]),
);
