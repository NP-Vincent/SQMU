import { LISTING_MAIL_URL } from './config.js';

/**
 * Send a listing confirmation email for a completed SQMU purchase.
 * @param {object} data - Key/value pairs to forward to the Apps Script
 */
export function sendListingConfirmation(data) {
  if (!LISTING_MAIL_URL) return;
  fetch(LISTING_MAIL_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString()
  });
}
