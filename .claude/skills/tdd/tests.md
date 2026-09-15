# 好测试与坏测试

## 好测试

**集成风格(Integration-style)**:透过真实接口测试,不 mock 内部零件。

```typescript
// GOOD: 验证的是可观察的行为
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

特征:

- 测的是用户/调用方真正关心的行为
- 只用公开 API
- 扛得住内部重构
- 描述的是"是什么(WHAT)",不是"怎么做(HOW)"
- 每个测试只有一个逻辑断言

## 坏测试

**实现细节测试**:和内部结构耦合在一起。

```typescript
// BAD: 测的是实现细节
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

危险信号:

- mock 掉了内部协作者
- 测试了私有方法
- 断言调用次数/调用顺序
- 重构之后测试挂了,但行为其实没变
- 测试名描述的是"怎么做"而不是"是什么"
- 绕开接口、从外部手段去验证

```typescript
// BAD: 绕开接口去验证
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// GOOD: 透过接口去验证
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

**同义反复的测试**:期望值只是把实现重新复述了一遍,所以这个测试天生就会通过。

```typescript
// BAD: 期望值是照着代码的算法重新算了一遍
test("calculateTotal sums line items", () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// GOOD: 期望值是一个独立的、已知的字面值
test("calculateTotal sums line items", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```
