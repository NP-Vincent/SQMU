// email.js - generic helper to send receipt details to Google Apps Script
import {
  LISTING_MAIL_URL,
  GOVERNANCE_MAIL_URL,
  RENT_MAIL_URL,
  ESCROW_MAIL_URL,
  PAYMENT_MAIL_URL
} from './config.js';

const URLS = {
  listing: LISTING_MAIL_URL,
  governance: GOVERNANCE_MAIL_URL,
  rent: RENT_MAIL_URL,
  escrow: ESCROW_MAIL_URL,
  payment: PAYMENT_MAIL_URL
};

/**
 * Send an email receipt for a completed transaction.
 * @param {string} type - One of 'listing', 'governance', 'rent', 'escrow'
 * @param {object} data - Key/value pairs to forward to the Apps Script
 */
export function sendReceipt(type, data) {
  const url = URLS[type];
  if (!url) return;
  fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(data).toString()
  });
}
