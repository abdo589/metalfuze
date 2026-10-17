# Bank of Riyadh (Riyad Bank) balance — automatic connection

## Before we start (needed from you)
In Saudi Arabia, a website can only read a bank balance through a SAMA-licensed open banking provider. I suggest **Lean Technologies** (it supports Riyad Bank).
1. Open an account at leantech.me (business plan; they require company documents).
2. Send me the **App Token** and **Client Secret** they give you. I'll save them in a secure place.

Until you have those, the page will be ready but will show "Not connected yet".

## What you will get
- A new **Bank** page in the side menu (view for everyone, connect/disconnect only for Eilaf & Eng Abdelrhman).
- A **Connect Riyad Bank** button: it opens the bank's official login screen. You approve once from your Riyad Bank app — no bank password is ever saved on our site.
- Cards: **Current balance**, **available balance**, last update time.
- A **latest transactions** table (date, description, in / out, balance), with search and Excel/PDF export using the company logo.
- Balance refreshes automatically when the page opens and with an **Update now** button.
- On the Budget page: a line comparing bank balance vs. "left to pay" across projects.
- Arabic and English.

## Technical details
- Secrets: LEAN_APP_TOKEN, LEAN_CLIENT_SECRET (server only).
- New table `bank_connections` (lean customer_id, entity_id, bank name, status, connected_at) + `bank_snapshots` (balance, available, currency, fetched_at); grants + RLS: read admin/viewer, write admin only.
- Server functions (requireSupabaseAuth + has_role admin for connect/disconnect): create Lean customer, return customer token for the Lean Link SDK, save entity after success, fetch balances/transactions from Lean API and store a snapshot.
- Public webhook route `/api/public/lean-webhook` verifying Lean's signature, updating connection status.
- Lean Link Web SDK loaded only in the browser after the page renders.
- Small test for balance/total calculations.
