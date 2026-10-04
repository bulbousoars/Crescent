import type { MailRules } from './provider';

// Zillow's listing alerts and newsletters use separate sender addresses.
export const DEFAULT_MAIL_RULES = {
  fromAllowlist: [
    'instant-updates@mail.zillow.com',
    'my-saved-home@mail.zillow.com',
    'open-houses@mail.zillow.com',
    'market-updates@mail.zillow.com',
    'recommendations@mail.zillow.com',
    'zmail@zmail.zillow.com',
  ],
  processedLabel: 'Real-Estate',
} satisfies MailRules;
