const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../db');
const { PaymentGatewayService } = require('../services/paymentGateway');

test('Deposit intent creates PENDING record and idempotent confirmation credits balance once', async () => {
  const db = createDatabase(':memory:');
  const gw = new PaymentGatewayService({ db });
  const user = db.getOrCreateUser('CashierTester');
  assert.equal(user.balanceCents, 100_000);

  const { transaction } = await gw.createDeposit({
    userId: user.id,
    asset: 'USDT-TRC20',
    amountCents: 25_000, // $250.00
  });
  assert.equal(transaction.status, 'PENDING');
  assert.equal(transaction.netCents, 25_000);
  assert.ok(transaction.destination.startsWith('T'));

  // Confirm deposit once -> balance becomes $1,250.00
  const confirmed1 = gw.confirmDeposit({ transactionId: transaction.id });
  assert.equal(confirmed1.alreadyCompleted, false);
  assert.equal(confirmed1.transaction.status, 'COMPLETED');
  assert.equal(confirmed1.user.balanceCents, 125_000);

  // Confirm same deposit a second time (webhook replay) -> strictly idempotent, no double credit!
  const confirmed2 = gw.confirmDeposit({ transactionId: transaction.id });
  assert.equal(confirmed2.alreadyCompleted, true);
  assert.equal(confirmed2.user.balanceCents, 125_000);

  gw.stop();
  db.close();
});

test('Withdrawal atomically debits balance, deducts network fee, and refunds cleanly on failure', async () => {
  const db = createDatabase(':memory:');
  const gw = new PaymentGatewayService({ db });
  const user = db.getOrCreateUser('WithdrawTester');

  // Request $100 USDT-TRC20 withdrawal ($1 network fee -> $99 net)
  const wd = await gw.requestWithdrawal({
    userId: user.id,
    asset: 'USDT-TRC20',
    amountCents: 10_000,
    destination: 'TXYZ1234567890ABCDEFGHIJKLMNOPQRST',
  });

  assert.equal(wd.transaction.status, 'PROCESSING');
  assert.equal(wd.transaction.feeCents, 100);
  assert.equal(wd.transaction.netCents, 9_900);
  assert.equal(wd.user.balanceCents, 90_000);

  // Simulate gateway failure -> automatic 100% refund back to $1,000.00
  const failed = db.updateWithdrawalStatus(wd.transaction.id, 'FAILED');
  assert.equal(failed.transaction.status, 'FAILED');
  assert.equal(failed.user.balanceCents, 100_000);

  // Overdraft withdrawal rejected
  await assert.rejects(
    () =>
      gw.requestWithdrawal({
        userId: user.id,
        asset: 'UPI',
        amountCents: 500_000,
        destination: 'trader@okaxis',
      }),
    /Insufficient wallet balance/
  );

  gw.stop();
  db.close();
});
