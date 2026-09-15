# 什么时候该 Mock

只在**系统边界**上 mock:

- 外部 API(支付、邮件等)
- 数据库(有时候——优先用测试数据库)
- 时间/随机数
- 文件系统(有时候)

不要 mock:

- 你自己写的类/模块
- 内部协作者
- 任何你自己能控制的东西

## 为可 mock 性做设计

在系统边界上,把接口设计成容易被 mock 的样子:

**1. 用依赖注入**

把外部依赖传进去,而不是在内部自己创建:

```typescript
// 容易 mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// 难以 mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. 优先用 SDK 风格的接口,而不是通用的 fetcher**

给每个外部操作写一个专属函数,而不是用一个带条件分支逻辑的通用函数:

```typescript
// GOOD: 每个函数都能独立被 mock
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// BAD: mock 的时候还得在 mock 内部写条件分支逻辑
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

SDK 风格的好处:
- 每个 mock 只返回一种固定形状的数据
- 测试的 setup 里不需要条件分支逻辑
- 更容易看清一个测试到底覆盖了哪些端点
- 每个端点都有各自的类型安全
