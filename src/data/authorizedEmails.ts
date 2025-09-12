// Admin email addresses
export const adminEmails = [
  "ahnaf816@gmail.com",
  "hasanxsarower@gmail.com",
];

// Student email addresses
export const studentEmails = [
  "abrarmasud20@gmail.com",
  "alexalamgirbd@gmail.com",
  "aseyasiddiqua30@gmail.com",
  "iloveburgers2456@gmail.com",
  "ayeshakhaled41@gmail.com",
  "aymaanzaman05@gmail.com",
  "kashfiaahmed70@gmail.com",
  "kibria.mobin@gmail.com",
  "mahira.akh24@gmail.com",
  "mansibrahmanofficial@gmail.com",
  "nazeefrahman.1208@gmail.com",
  "ntasfia4@gmail.com",
  "ramisamaliatyashra@gmail.com",
  "snehaasadia@gmail.com",
  "sajid.rimo25@gmail.com",
  "sara.b.iftekhar@gmail.com",
  "sharafalam16@gmail.com",
  "sharikachowdhury03@gmail.com",
  "tahiyatabdullah@gmail.com",
  "sk.tarannum06@gmail.com",
  "mahmudwazeed@gmail.com",
  "zaianjannat0001@gmail.com",
  "zuhayradeeb@gmail.com",
];

// Combined authorized emails
export const authorizedEmails = [...adminEmails, ...studentEmails];

export function isEmailAuthorized(email: string): boolean {
  return authorizedEmails.includes(email.toLowerCase());
}

export function isAdminEmail(email: string): boolean {
  return adminEmails.includes(email.toLowerCase());
}