# Skill 写作机制

这是 [`writing-for-agents`](SKILL.md) 里专属 skill 的那一支:当要写的文档是一个 skill 时,有哪些地方不一样(frontmatter、触发方式怎么选、以及路由型 skill)。除此之外的写法,都遵循 `SKILL.md` 里那份通用参考。

## 触发方式(Invocation)

两种选择,各自花的是两种负荷中的一种:

- **模型可自主触发(model-invoked)** 的 skill 保留 `description`,这样 agent 能自己判断触发它,别的 skill 也能触达它。你依然可以手动打出它的名字来调用——模型可触发**永远包含**用户可触达这一条;description 只会给 agent 添一条自主发现的路,从不会拿走人手动触发的权利。这个 description 是这个 skill 的顶层情境指针,被强制常驻加载:用永久的情境负荷,换来"能被自主发现"。一个内容全是参考、且模型可自主触发的 skill,同时也是共享参考的一个落脚点:别的 skill 能调用它,于是好几个 skill 都要用到的参考内容就能收在一个地方。做法:不写 `disable-model-invocation`,并写一条面向模型的 description,把触发分支都写进去(`SKILL.md` 里那套写指针的规则,在这里完全适用)。
- **仅限用户手动触发(user-invoked)** 的 skill,会把 description 从 agent 的触达范围里拿掉:只有人手动打出它的名字才能调用它,别的 skill 也调用不到它。情境负荷是零,但要花认知负荷:你自己就是那个必须记得"这个 skill 存在"的索引。做法:设置 `disable-model-invocation: true`;这时 `description` 变成给人看的东西——一行摘要,不再需要写触发分支列表。

只有在"agent 必须能自己找到这个 skill"或者"别的 skill 必须能调用到它"的时候,才选模型可自主触发。如果它永远只靠人手动触发,就设成仅限用户手动触发,不用付情境负荷。

## 按触发方式拆分

这是拆分的"触发方式"这一刀(按时序拆的那一刀写在 `SKILL.md` 里):当你有一个明确的锚点词、这个词本身就该单独触发某个 skill(一个你在 prompt 里真的会用到的触发词),或者别的 skill 必须能调用到它时,才把它拆成一个独立的、模型可自主触发的 skill。你会为这个新增的常驻 description 付出情境负荷,所以这份"能被独立触达"的收益必须配得上这份代价。

## 路由型 skill(Router Skill)

当仅限用户手动触发的 skill 多到你记不过来时,这份堆起来的认知负荷,可以靠一个**路由型 skill(router skill)** 来治:用一个用户手动触发的 skill,把其余的 skill 都点名列出来,并说明什么情况该用哪个,这样人只需要记住这一个 skill,而不是记住一堆。它只能提示,不能真的替你去触发别的 skill——因为仅限用户手动触发的 skill 没有 description,除了人自己,谁都触达不到它们。
