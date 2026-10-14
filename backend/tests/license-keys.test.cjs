const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

test("purchases deliver persistent private demo keys; creators have no purchase key", async () => {
  const directory = mkdtempSync(path.join(__dirname, "../prisma/license-test-"));
  process.env.DATABASE_URL = `file:./${path.basename(directory)}/test.db`;
  writeFileSync(path.join(directory, "test.db"), "");
  process.env.EMAIL_DELIVERY_MODE = "preview";
  let server;
  let prisma;
  try {
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
      env: process.env,
      stdio: "pipe",
    });
    const { app } = require("../dist/src/app");
    prisma = require("../dist/src/lib/prisma").prisma;
    const { signToken } = require("../dist/src/utils/jwt");
    const createUser = (username, role = "CUSTOMER") => prisma.user.create({
      data: { username, email: `${username}@example.com`, password: "unused-test-hash", role },
    });
    const buyer = await createUser("buyer");
    const other = await createUser("other");
    const creator = await createUser("creator", "DEVELOPER");
    const developer = await prisma.developer.create({ data: { userId: creator.id, company: "Demo" } });
    const game = await prisma.game.create({ data: {
      title: "Test game", description: "Demo", price: 5, releaseDate: new Date(), developerId: developer.id,
    } });
    server = await new Promise(resolve => { const instance = app.listen(0, "127.0.0.1", () => resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = (route, user, body) => fetch(base + route, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${signToken({ userId: user.id, email: user.email, username: user.username, role: user.role })}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal((await request("/library/me")).status, 401);
    const purchase = async user => {
      await prisma.cart.create({ data: { userId: user.id, items: { create: { gameId: game.id } } } });
      const response = await request("/orders/checkout", user, { paymentMethod: "PAYPAL", paymentDetails: { paypalEmail: user.email } });
      assert.equal(response.status, 201, await response.text());
    };
    await purchase(buyer);
    const first = (await (await request("/library/me", buyer)).json()).library[0];
    assert.match(first.licenseKey, /^DEMO-(?:[A-F0-9]{4}-){3}[A-F0-9]{4}$/);
    assert.deepEqual((await (await request("/library/me", other)).json()).library, []);
    await purchase(other);
    const second = (await (await request("/library/me", other)).json()).library[0];
    assert.notEqual(first.licenseKey, second.licenseKey);
    await prisma.$disconnect();
    assert.equal((await (await request("/library/me", buyer)).json()).library[0].licenseKey, first.licenseKey);
    const creatorEntry = (await (await request("/library/me", creator)).json()).library[0];
    assert.ok(creatorEntry.id < 0);
    assert.equal(creatorEntry.licenseKey, null);
    const publicGame = await (await request(`/games/${game.id}`)).json();
    assert.ok(!JSON.stringify(publicGame).includes(first.licenseKey));
    await prisma.cartItem.create({ data: { cartId: (await prisma.cart.findUnique({ where: { userId: buyer.id } })).id, gameId: game.id } });
    assert.equal((await request("/orders/checkout", buyer, { paymentMethod: "PAYPAL", paymentDetails: { paypalEmail: buyer.email } })).status, 409);
    assert.equal((await (await request("/library/me", buyer)).json()).library[0].licenseKey, first.licenseKey);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (prisma) await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
