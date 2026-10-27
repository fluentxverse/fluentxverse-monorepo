const names = { agnes: ['agnesveloso', 'agnes.veloso'], mark: ['markvibas', 'mark.vibas'], paul: ['paularriola', 'paul.arriola'], yehna: ['yehnalee', 'yehna.lee'], support: ['support', 'support'] };

export function dottedMailboxAccounts(accounts) {
  if (accounts.length !== 5 || new Set(accounts.map(account => account.id)).size !== 5) throw Error('Expected five distinct configured mailboxes.');
  return accounts.map(account => {
    const pair = names[account.id];
    if (!pair) throw Error('Unexpected mailbox ID.');
    const [previous, next] = pair.map(name => `${name}@fluentxverse.com`);
    if (![previous, next].includes(account.address) || account.imap.user !== account.address || account.smtp.user !== account.address) throw Error('Unexpected mailbox address or login.');
    if (account.id === 'support') return account;
    return { ...account, address: next, label: account.label === account.address ? next : account.label,
      imap: { ...account.imap, user: next }, smtp: { ...account.smtp, user: next } };
  });
}
