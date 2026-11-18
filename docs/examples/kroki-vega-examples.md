---
title: Kroki 与 Vega-Lite
tags: [图表, Kroki, Vega]
---

# Kroki 与 Vega-Lite

## Kroki 通用入口

一个 `kroki` 入口支持 Blockdiag / Seqdiag / Actdiag / Nwdiag / Packetdiag /
Rackdiag / Bytefield / Ditaa / Erd / Graphviz / Nomnoml / Svgbob / Umlet 等：
fence 信息串第二个 token 是图类型，正文为图源码。

**源码**（blockdiag：节点标签用 `label="…"` 紧贴引号写法）：

````markdown
```kroki blockdiag
{
  orientation = portrait
  A[label="客户端"];
  B[label="网关"];
  C[label="认证服务"];
  D[label="业务服务"];
  E[label="数据库"];
  A -> B; B -> C; B -> D; C -> E;
}
```
````

**渲染效果**：

```kroki blockdiag
{
  orientation = portrait
  A[label="客户端"];
  B[label="网关"];
  C[label="认证服务"];
  D[label="业务服务"];
  E[label="数据库"];
  A -> B; B -> C; B -> D; C -> E;
}
```

**源码**（seqdiag：边标签用 `[label="…"]`）：

````markdown
```kroki seqdiag
{
  client -> gateway [label="GET /api"];
  gateway -> auth [label="校验"];
  auth -> gateway [label="通过"];
  gateway -> db [label="查询"];
  gateway -> client [label="响应"];
}
```
````

**渲染效果**：

```kroki seqdiag
{
  client -> gateway [label="GET /api"];
  gateway -> auth [label="校验"];
  auth -> gateway [label="通过"];
  gateway -> db [label="查询"];
  gateway -> client [label="响应"];
}
```

**源码**（nwdiag 拓扑网）：

````markdown
```kroki nwdiag
nwdiag {
  network dmz {
    web01 [label = "Web 01"];
    web02 [label = "Web 02"];
  }
  network core {
    gw01 [label = "网关"];
  }
}
```
````

**渲染效果**：

```kroki nwdiag
nwdiag {
  network dmz {
    web01 [label = "Web 01"];
    web02 [label = "Web 02"];
  }
  network core {
    gw01 [label = "网关"];
  }
}
```

**源码**（actdiag 活动图）：

````markdown
```kroki actdiag
actdiag {
  write -> review -> publish
  lane user {
    write [label = "写文档"];
    publish [label = "发布"];
  }
  lane team {
    review [label = "评审"];
  }
}
```
````

**渲染效果**：

```kroki actdiag
actdiag {
  write -> review -> publish
  lane user {
    write [label = "写文档"];
    publish [label = "发布"];
  }
  lane team {
    review [label = "评审"];
  }
}
```


## Kroki 图类型补充示例

以下每种类型给出 10 个可直接渲染的短示例，每段先列源码，再给出渲染块，两处源码完全一致。

### blockdiag — 方框图

````markdown
```kroki blockdiag
blockdiag {
  A -> B -> C;
}
```
````

```kroki blockdiag
blockdiag {
  A -> B -> C;
}
```

````markdown
```kroki blockdiag
blockdiag {
  LB -> web1, web2, web3;
  web1 -> DB;
  web2 -> DB;
  web3 -> DB;
}
```
````

```kroki blockdiag
blockdiag {
  LB -> web1, web2, web3;
  web1 -> DB;
  web2 -> DB;
  web3 -> DB;
}
```

````markdown
```kroki blockdiag
blockdiag {
  orientation = portrait;
  client [label = "客户端"];
  gateway [label = "网关"];
  service [label = "服务"];
  client -> gateway -> service;
}
```
````

```kroki blockdiag
blockdiag {
  orientation = portrait;
  client [label = "客户端"];
  gateway [label = "网关"];
  service [label = "服务"];
  client -> gateway -> service;
}
```

````markdown
```kroki blockdiag
blockdiag {
  start [shape = circle];
  check [shape = diamond];
  done [shape = roundedbox];
  start -> check -> done;
}
```
````

```kroki blockdiag
blockdiag {
  start [shape = circle];
  check [shape = diamond];
  done [shape = roundedbox];
  start -> check -> done;
}
```

````markdown
```kroki blockdiag
blockdiag {
  group {
    label = "DMZ";
    web1;
    web2;
  }
  db;
  web1 -> db;
  web2 -> db;
}
```
````

```kroki blockdiag
blockdiag {
  group {
    label = "DMZ";
    web1;
    web2;
  }
  db;
  web1 -> db;
  web2 -> db;
}
```

````markdown
```kroki blockdiag
blockdiag {
  A [color = "#ffcccc", style = dashed];
  B [color = "#ccffcc"];
  C [color = "#ccccff"];
  A -> B [color = red];
  B -> C [style = dotted];
}
```
````

```kroki blockdiag
blockdiag {
  A [color = "#ffcccc", style = dashed];
  B [color = "#ccffcc"];
  C [color = "#ccccff"];
  A -> B [color = red];
  B -> C [style = dotted];
}
```

````markdown
```kroki blockdiag
blockdiag {
  A -> B [label = "POST /login"];
  B -> C [label = "select"];
  C -> B [label = "row"];
}
```
````

```kroki blockdiag
blockdiag {
  A -> B [label = "POST /login"];
  B -> C [label = "select"];
  C -> B [label = "row"];
}
```

````markdown
```kroki blockdiag
blockdiag {
  class hot [color = "#ffdddd"];
  api [class = hot];
  cache;
  db;
  api -> cache;
  cache -> db;
}
```
````

```kroki blockdiag
blockdiag {
  class hot [color = "#ffdddd"];
  api [class = hot];
  cache;
  db;
  api -> cache;
  cache -> db;
}
```

````markdown
```kroki blockdiag
blockdiag {
  default_shape = roundedbox;
  default_fontsize = 14;
  A -> B;
  A -> C;
  B -> D;
  C -> D;
}
```
````

```kroki blockdiag
blockdiag {
  default_shape = roundedbox;
  default_fontsize = 14;
  A -> B;
  A -> C;
  B -> D;
  C -> D;
}
```

````markdown
```kroki blockdiag
blockdiag {
  group {
    label = "前端";
    ui; api;
  }
  group {
    label = "后端";
    svc; db;
  }
  ui -> api -> svc -> db;
}
```
````

```kroki blockdiag
blockdiag {
  group {
    label = "前端";
    ui; api;
  }
  group {
    label = "后端";
    svc; db;
  }
  ui -> api -> svc -> db;
}
```

### seqdiag — 时序图

````markdown
```kroki seqdiag
seqdiag {
  browser -> server [label = "GET /"];
  server -> browser [label = "200 OK"];
}
```
````

```kroki seqdiag
seqdiag {
  browser -> server [label = "GET /"];
  server -> browser [label = "200 OK"];
}
```

````markdown
```kroki seqdiag
seqdiag {
  browser -> gateway [label = "request"];
  gateway -> service [label = "forward"];
  service -> db [label = "SELECT"];
}
```
````

```kroki seqdiag
seqdiag {
  browser -> gateway [label = "request"];
  gateway -> service [label = "forward"];
  service -> db [label = "SELECT"];
}
```

````markdown
```kroki seqdiag
seqdiag {
  client -> api [label = "submit"];
  api -> api [label = "validate"];
  api -> client [label = "ok"];
}
```
````

```kroki seqdiag
seqdiag {
  client -> api [label = "submit"];
  api -> api [label = "validate"];
  api -> client [label = "ok"];
}
```

````markdown
```kroki seqdiag
seqdiag {
  A -> B [label = "one"];
  B -> C [label = "two"];
  C -> D [label = "three"];
  D -> A [label = "four"];
}
```
````

```kroki seqdiag
seqdiag {
  A -> B [label = "one"];
  B -> C [label = "two"];
  C -> D [label = "three"];
  D -> A [label = "four"];
}
```

````markdown
```kroki seqdiag
seqdiag {
  user -> auth [label = "login", return = "token"];
}
```
````

```kroki seqdiag
seqdiag {
  user -> auth [label = "login", return = "token"];
}
```

````markdown
```kroki seqdiag
seqdiag {
  A [color = "#ffcccc"];
  B [color = "#ccffcc"];
  A -> B [color = red];
  B -> A [color = blue];
}
```
````

```kroki seqdiag
seqdiag {
  A [color = "#ffcccc"];
  B [color = "#ccffcc"];
  A -> B [color = red];
  B -> A [color = blue];
}
```

````markdown
```kroki seqdiag
seqdiag {
  UI => queue [label = "publish"];
  queue => worker [label = "consume"];
  worker -> db [label = "write"];
}
```
````

```kroki seqdiag
seqdiag {
  UI => queue [label = "publish"];
  queue => worker [label = "consume"];
  worker -> db [label = "write"];
}
```

````markdown
```kroki seqdiag
seqdiag {
  A -> B [label = "call", note = "retry up to 3 times"];
  B -> A [label = "result"];
}
```
````

```kroki seqdiag
seqdiag {
  A -> B [label = "call", note = "retry up to 3 times"];
  B -> A [label = "result"];
}
```

````markdown
```kroki seqdiag
seqdiag {
  edge_length = 220;
  default_fontsize = 12;
  client -> server [label = "ping"];
  server -> client [label = "pong"];
}
```
````

```kroki seqdiag
seqdiag {
  edge_length = 220;
  default_fontsize = 12;
  client -> server [label = "ping"];
  server -> client [label = "pong"];
}
```

````markdown
```kroki seqdiag
seqdiag {
  user -> app [label = "open"];
  app -> cache [label = "get", style = dashed];
  cache -> app [label = "miss"];
  app -> user [label = "render"];
}
```
````

```kroki seqdiag
seqdiag {
  user -> app [label = "open"];
  app -> cache [label = "get", style = dashed];
  cache -> app [label = "miss"];
  app -> user [label = "render"];
}
```

### actdiag — 活动图

````markdown
```kroki actdiag
actdiag {
  lane flow {
    label = "Flow";
    plan -> build -> test -> ship;
  }
}
```
````

```kroki actdiag
actdiag {
  lane flow {
    label = "Flow";
    plan -> build -> test -> ship;
  }
}
```

````markdown
```kroki actdiag
actdiag {
  submit -> review;
  lane user {
    label = "用户";
    submit;
  }
  lane staff {
    label = "审核";
    review;
  }
}
```
````

```kroki actdiag
actdiag {
  submit -> review;
  lane user {
    label = "用户";
    submit;
  }
  lane staff {
    label = "审核";
    review;
  }
}
```

````markdown
```kroki actdiag
actdiag {
  lane check {
    label = "Check";
    check [shape = diamond];
    check -> ok [label = "yes"];
    check -> fail [label = "no"];
  }
}
```
````

```kroki actdiag
actdiag {
  lane check {
    label = "Check";
    check [shape = diamond];
    check -> ok [label = "yes"];
    check -> fail [label = "no"];
  }
}
```

````markdown
```kroki actdiag
actdiag {
  lane flow {
    label = "Flow";
    A -> B, C;
    B -> D;
    C -> D;
  }
}
```
````

```kroki actdiag
actdiag {
  lane flow {
    label = "Flow";
    A -> B, C;
    B -> D;
    C -> D;
  }
}
```

````markdown
```kroki actdiag
actdiag {
  client -> api -> db;
  lane client { client; }
  lane backend { api; }
  lane data { db; }
}
```
````

```kroki actdiag
actdiag {
  client -> api -> db;
  lane client { client; }
  lane backend { api; }
  lane data { db; }
}
```

````markdown
```kroki actdiag
actdiag {
  lane flow {
    label = "Flow";
    A [color = "#ffcccc"];
    B;
    A -> B [style = dashed, color = red];
  }
}
```
````

```kroki actdiag
actdiag {
  lane flow {
    label = "Flow";
    A [color = "#ffcccc"];
    B;
    A -> B [style = dashed, color = red];
  }
}
```

````markdown
```kroki actdiag
actdiag {
  lane flow {
    label = "Flow";
    s [shape = beginpoint];
    work;
    e [shape = endpoint];
    s -> work -> e;
  }
}
```
````

```kroki actdiag
actdiag {
  lane flow {
    label = "Flow";
    s [shape = beginpoint];
    work;
    e [shape = endpoint];
    s -> work -> e;
  }
}
```

````markdown
```kroki actdiag
actdiag {
  lane review {
    label = "Review";
    draft -> review [label = "submit"];
    review -> publish [label = "approve"];
    review -> draft [label = "revise"];
  }
}
```
````

```kroki actdiag
actdiag {
  lane review {
    label = "Review";
    draft -> review [label = "submit"];
    review -> publish [label = "approve"];
    review -> draft [label = "revise"];
  }
}
```

````markdown
```kroki actdiag
actdiag {
  lane web { ui; api; }
  lane data { queue; db; }
  ui -> api -> queue -> db;
}
```
````

```kroki actdiag
actdiag {
  lane web { ui; api; }
  lane data { queue; db; }
  ui -> api -> queue -> db;
}
```

````markdown
```kroki actdiag
actdiag {
  request [shape = diamond];
  request -> approve [label = "ok"];
  request -> reject [label = "ng"];
  lane ops {
    label = "Ops";
    approve;
    reject;
  }
}
```
````

```kroki actdiag
actdiag {
  request [shape = diamond];
  request -> approve [label = "ok"];
  request -> reject [label = "ng"];
  lane ops {
    label = "Ops";
    approve;
    reject;
  }
}
```

### nwdiag — 网络拓扑图

````markdown
```kroki nwdiag
nwdiag {
  network dmz {
    address = "10.0.0.0/24";
    web01 [address = "10.0.0.1"];
    web02 [address = "10.0.0.2"];
  }
}
```
````

```kroki nwdiag
nwdiag {
  network dmz {
    address = "10.0.0.0/24";
    web01 [address = "10.0.0.1"];
    web02 [address = "10.0.0.2"];
  }
}
```

````markdown
```kroki nwdiag
nwdiag {
  network public {
    address = "203.0.113.0/24";
    lb [address = "203.0.113.10"];
  }
  network private {
    address = "10.0.0.0/24";
    lb;
    app [address = "10.0.0.21"];
  }
}
```
````

```kroki nwdiag
nwdiag {
  network public {
    address = "203.0.113.0/24";
    lb [address = "203.0.113.10"];
  }
  network private {
    address = "10.0.0.0/24";
    lb;
    app [address = "10.0.0.21"];
  }
}
```

````markdown
```kroki nwdiag
nwdiag {
  network edge { web [address = "10.0.1.1"]; }
  network app { web; api [address = "10.0.2.1"]; }
  network data { api; db [address = "10.0.3.1"]; }
}
```
````

```kroki nwdiag
nwdiag {
  network edge { web [address = "10.0.1.1"]; }
  network app { web; api [address = "10.0.2.1"]; }
  network data { api; db [address = "10.0.3.1"]; }
}
```

````markdown
```kroki nwdiag
nwdiag {
  network dmz {
    group {
      label = "web tier";
      web01;
      web02;
    }
    db;
  }
}
```
````

```kroki nwdiag
nwdiag {
  network dmz {
    group {
      label = "web tier";
      web01;
      web02;
    }
    db;
  }
}
```

````markdown
```kroki nwdiag
nwdiag {
  network dmz {
    color = "#ffcccc";
    web01;
    web02;
  }
}
```
````

```kroki nwdiag
nwdiag {
  network dmz {
    color = "#ffcccc";
    web01;
    web02;
  }
}
```

````markdown
```kroki nwdiag
nwdiag {
  network internet {
    gw [shape = cloud];
  }
  network lan {
    gw;
    pc01;
  }
}
```
````

```kroki nwdiag
nwdiag {
  network internet {
    gw [shape = cloud];
  }
  network lan {
    gw;
    pc01;
  }
}
```

````markdown
```kroki nwdiag
nwdiag {
  network lan {
    address = "192.168.1.0/24";
    router [address = "192.168.1.1", color = "#ffcccc"];
    switch [address = "192.168.1.2"];
  }
}
```
````

```kroki nwdiag
nwdiag {
  network lan {
    address = "192.168.1.0/24";
    router [address = "192.168.1.1", color = "#ffcccc"];
    switch [address = "192.168.1.2"];
  }
}
```

````markdown
```kroki nwdiag
nwdiag {
  network dmz {
    address = "10.0.0.0/24";
    lb [address = "10.0.0.10"];
    web01 [address = "10.0.0.11"];
    web02 [address = "10.0.0.12"];
    web03 [address = "10.0.0.13"];
  }
}
```
````

```kroki nwdiag
nwdiag {
  network dmz {
    address = "10.0.0.0/24";
    lb [address = "10.0.0.10"];
    web01 [address = "10.0.0.11"];
    web02 [address = "10.0.0.12"];
    web03 [address = "10.0.0.13"];
  }
}
```

````markdown
```kroki nwdiag
nwdiag {
  network office {
    address = "172.16.0.0/24";
    printer;
    laptop;
    phone;
  }
}
```
````

```kroki nwdiag
nwdiag {
  network office {
    address = "172.16.0.0/24";
    printer;
    laptop;
    phone;
  }
}
```

````markdown
```kroki nwdiag
nwdiag {
  network a { address = "10.1.0.0/24"; fw [address = "10.1.0.1"]; }
  network b { address = "10.2.0.0/24"; fw; srv; }
  network c { address = "10.3.0.0/24"; srv; db; }
}
```
````

```kroki nwdiag
nwdiag {
  network a { address = "10.1.0.0/24"; fw [address = "10.1.0.1"]; }
  network b { address = "10.2.0.0/24"; fw; srv; }
  network c { address = "10.3.0.0/24"; srv; db; }
}
```

### packetdiag — 报文结构图

````markdown
```kroki packetdiag
packetdiag {
  colwidth = 32;
  0-7: "Version";
  8-15: "IHL";
  16-31: "Total Length";
}
```
````

```kroki packetdiag
packetdiag {
  colwidth = 32;
  0-7: "Version";
  8-15: "IHL";
  16-31: "Total Length";
}
```

````markdown
```kroki packetdiag
packetdiag {
  colwidth = 32;
  0-7: "Type";
  8-15: "Code";
  16-31: "Checksum";
  32-63: "Payload";
}
```
````

```kroki packetdiag
packetdiag {
  colwidth = 32;
  0-7: "Type";
  8-15: "Code";
  16-31: "Checksum";
  32-63: "Payload";
}
```

````markdown
```kroki packetdiag
packetdiag {
  colwidth = 32;
  0-15: "Source Port";
  16-31: "Dest Port";
  32-63: "Sequence";
  64-95: "Ack Number";
  96-99: "Offset";
  100-105: "Reserved";
  106-111: "Flags";
}
```
````

```kroki packetdiag
packetdiag {
  colwidth = 32;
  0-15: "Source Port";
  16-31: "Dest Port";
  32-63: "Sequence";
  64-95: "Ack Number";
  96-99: "Offset";
  100-105: "Reserved";
  106-111: "Flags";
}
```

````markdown
```kroki packetdiag
packetdiag {
  0: "C" [rotate = 270];
  1: "E" [rotate = 270];
  2: "U" [rotate = 270];
  3: "A" [rotate = 270];
  4: "P" [rotate = 270];
  5-7: "rsv";
}
```
````

```kroki packetdiag
packetdiag {
  0: "C" [rotate = 270];
  1: "E" [rotate = 270];
  2: "U" [rotate = 270];
  3: "A" [rotate = 270];
  4: "P" [rotate = 270];
  5-7: "rsv";
}
```

````markdown
```kroki packetdiag
packetdiag {
  colwidth = 16;
  0-3: "Ver";
  4-7: "Len";
  8-15: "Payload";
}
```
````

```kroki packetdiag
packetdiag {
  colwidth = 16;
  0-3: "Ver";
  4-7: "Len";
  8-15: "Payload";
}
```

````markdown
```kroki packetdiag
packetdiag {
  colwidth = 16;
  0-3: "Ver" [color = "#ffcccc"];
  4-7: "Len" [color = "#ccffcc"];
  8-15: "Data";
}
```
````

```kroki packetdiag
packetdiag {
  colwidth = 16;
  0-3: "Ver" [color = "#ffcccc"];
  4-7: "Len" [color = "#ccffcc"];
  8-15: "Data";
}
```

````markdown
```kroki packetdiag
packetdiag {
  colwidth = 8;
  0-7: "header";
  8-15: "body" [colheight = 2];
  16-23: "tail";
}
```
````

```kroki packetdiag
packetdiag {
  colwidth = 8;
  0-7: "header";
  8-15: "body" [colheight = 2];
  16-23: "tail";
}
```

````markdown
```kroki packetdiag
packetdiag {
  colwidth = 32;
  0-31: "Word 0";
  32-63: "Word 1";
  64-95: "Word 2";
}
```
````

```kroki packetdiag
packetdiag {
  colwidth = 32;
  0-31: "Word 0";
  32-63: "Word 1";
  64-95: "Word 2";
}
```

````markdown
```kroki packetdiag
packetdiag {
  colwidth = 32;
  0-3: "Version";
  4-11: "Traffic Class";
  12-31: "Flow Label";
  32-47: "Payload Length";
  48-55: "Next Header";
  56-63: "Hop Limit";
}
```
````

```kroki packetdiag
packetdiag {
  colwidth = 32;
  0-3: "Version";
  4-11: "Traffic Class";
  12-31: "Flow Label";
  32-47: "Payload Length";
  48-55: "Next Header";
  56-63: "Hop Limit";
}
```

````markdown
```kroki packetdiag
packetdiag {
  colwidth = 16;
  0-15: "ID";
  16-31: "Flags";
  32-47: "QDCOUNT";
  48-63: "ANCOUNT";
  64-79: "NSCOUNT";
  80-95: "ARCOUNT";
}
```
````

```kroki packetdiag
packetdiag {
  colwidth = 16;
  0-15: "ID";
  16-31: "Flags";
  32-47: "QDCOUNT";
  48-63: "ANCOUNT";
  64-79: "NSCOUNT";
  80-95: "ARCOUNT";
}
```

### rackdiag — 机架布局图

````markdown
```kroki rackdiag
rackdiag {
  8U;
  1: UPS;
  2: Switch;
  3: Server;
  4: Storage;
}
```
````

```kroki rackdiag
rackdiag {
  8U;
  1: UPS;
  2: Switch;
  3: Server;
  4: Storage;
}
```

````markdown
```kroki rackdiag
rackdiag {
  16U;
  1: "PDU" [1U];
  2: "Switch" [1U];
  3: "App 01" [2U];
  5: "App 02" [2U];
  7: "DB" [4U];
}
```
````

```kroki rackdiag
rackdiag {
  16U;
  1: "PDU" [1U];
  2: "Switch" [1U];
  3: "App 01" [2U];
  5: "App 02" [2U];
  7: "DB" [4U];
}
```

````markdown
```kroki rackdiag
rackdiag {
  8U;
  1: "Firewall" [color = "#ffcccc"];
  2: "Switch" [color = "#ccffcc"];
  3: "Server";
}
```
````

```kroki rackdiag
rackdiag {
  8U;
  1: "Firewall" [color = "#ffcccc"];
  2: "Switch" [color = "#ccffcc"];
  3: "Server";
}
```

````markdown
```kroki rackdiag
rackdiag {
  8U;
  1: "web01" [description = "8C / 32G"];
  2: "web02" [description = "8C / 32G"];
  3: "db01";
}
```
````

```kroki rackdiag
rackdiag {
  8U;
  1: "web01" [description = "8C / 32G"];
  2: "web02" [description = "8C / 32G"];
  3: "db01";
}
```

````markdown
```kroki rackdiag
rackdiag {
  12U;
  1: "Patch Panel";
  2: "Core Switch";
  3: "Router";
  4: "Server A" [2U];
  6: "Server B" [2U];
}
```
````

```kroki rackdiag
rackdiag {
  12U;
  1: "Patch Panel";
  2: "Core Switch";
  3: "Router";
  4: "Server A" [2U];
  6: "Server B" [2U];
}
```

````markdown
```kroki rackdiag
rackdiag {
  42U;
  1: "PDU";
  2: "ToR Switch";
  20: "Compute 01" [2U];
  30: "Storage" [4U];
}
```
````

```kroki rackdiag
rackdiag {
  42U;
  1: "PDU";
  2: "ToR Switch";
  20: "Compute 01" [2U];
  30: "Storage" [4U];
}
```

````markdown
```kroki rackdiag
rackdiag {
  rack {
    8U;
    1: "A-Switch";
    2: "A-Server";
  }
  rack {
    8U;
    1: "B-Switch";
  }
}
```
````

```kroki rackdiag
rackdiag {
  rack {
    8U;
    1: "A-Switch";
    2: "A-Server";
  }
  rack {
    8U;
    1: "B-Switch";
  }
}
```

````markdown
```kroki rackdiag
rackdiag {
  10U;
  1: "Load Balancer" [2U];
  3: "App 1" [2U];
  5: "App 2" [2U];
  7: "App 3" [2U];
}
```
````

```kroki rackdiag
rackdiag {
  10U;
  1: "Load Balancer" [2U];
  3: "App 1" [2U];
  5: "App 2" [2U];
  7: "App 3" [2U];
}
```

````markdown
```kroki rackdiag
rackdiag {
  8U;
  1: "UPS" [2U, color = "#ffe0b3", description = "3 kVA"];
  3: "Switch" [color = "#cce5ff"];
  4: "Server" [2U, description = "app"];
}
```
````

```kroki rackdiag
rackdiag {
  8U;
  1: "UPS" [2U, color = "#ffe0b3", description = "3 kVA"];
  3: "Switch" [color = "#cce5ff"];
  4: "Server" [2U, description = "app"];
}
```

````markdown
```kroki rackdiag
rackdiag {
  24U;
  1: "PDU A";
  2: "PDU B";
  3: "Switch";
  4: "KVM";
  5: "Server 01" [2U];
  7: "Server 02" [2U];
}
```
````

```kroki rackdiag
rackdiag {
  24U;
  1: "PDU A";
  2: "PDU B";
  3: "Switch";
  4: "KVM";
  5: "Server 01" [2U];
  7: "Server 02" [2U];
}
```

### bytefield — 字节域图

````markdown
```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Type" {:span 8})
(draw-box "Payload" {:span 8})
```
````

```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Type" {:span 8})
(draw-box "Payload" {:span 8})
```

````markdown
```kroki bytefield
(def boxes-per-row 8)
(draw-column-headers)
(draw-box 0x7e {:span 1})
(draw-box "addr" {:span 7})
```
````

```kroki bytefield
(def boxes-per-row 8)
(draw-column-headers)
(draw-box 0x7e {:span 1})
(draw-box "addr" {:span 7})
```

````markdown
```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Header" {:span 4})
(draw-box "reserved" {:span 4 :borders #{}})
(draw-box "Body" {:span 8})
```
````

```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Header" {:span 4})
(draw-box "reserved" {:span 4 :borders #{}})
(draw-box "Body" {:span 8})
```

````markdown
```kroki bytefield
(defattrs :hdr {:fill "#cce5ff"})
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Flags" [{:span 4} :hdr])
(draw-box "Value" {:span 12})
```
````

```kroki bytefield
(defattrs :hdr {:fill "#cce5ff"})
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Flags" [{:span 4} :hdr])
(draw-box "Value" {:span 12})
```

````markdown
```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "A" {:span 16})
(next-row 30)
(draw-box "B" {:span 16})
```
````

```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "A" {:span 16})
(next-row 30)
(draw-box "B" {:span 16})
```

````markdown
```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box (hex-text 0x0800 4 :bold) {:span 4})
(draw-box "data" {:span 12})
```
````

```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box (hex-text 0x0800 4 :bold) {:span 4})
(draw-box "data" {:span 12})
```

````markdown
```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "top" {:span 16 :borders #{}})
(next-row 40)
(draw-box "bottom" {:span 16})
```
````

```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "top" {:span 16 :borders #{}})
(next-row 40)
(draw-box "bottom" {:span 16})
```

````markdown
```kroki bytefield
(def boxes-per-row 8)
(draw-column-headers)
(draw-box "cmd" {:span 8 :height 40})
(next-row 60)
(draw-box "arg" {:span 8})
```
````

```kroki bytefield
(def boxes-per-row 8)
(draw-column-headers)
(draw-box "cmd" {:span 8 :height 40})
(next-row 60)
(draw-box "arg" {:span 8})
```

````markdown
```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box (text "seq" :math) {:span 8})
(draw-box (text "ack" :math) {:span 8})
(draw-box "window" {:span 16})
```
````

```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box (text "seq" :math) {:span 8})
(draw-box (text "ack" :math) {:span 8})
(draw-box "window" {:span 16})
```

````markdown
```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Version" {:span 4})
(draw-box "IHL" {:span 4})
(draw-box "TOS" {:span 8})
(draw-box "Total Length" {:span 16})
```
````

```kroki bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Version" {:span 4})
(draw-box "IHL" {:span 4})
(draw-box "TOS" {:span 8})
(draw-box "Total Length" {:span 16})
```

### ditaa — ASCII 示意图

````markdown
```kroki ditaa
+------+      +------+
| User |----->| App  |
+------+      +------+
```
````

```kroki ditaa
+------+      +------+
| User |----->| App  |
+------+      +------+
```

````markdown
```kroki ditaa
+-------+
| Start |
+-------+
    |
    v
+-------+
| Done  |
+-------+
```
````

```kroki ditaa
+-------+
| Start |
+-------+
    |
    v
+-------+
| Done  |
+-------+
```

````markdown
```kroki ditaa
+------+     +------+     +------+
| HTTP |---->| Auth |---->| DB   |
+------+     +------+     +------+
```
````

```kroki ditaa
+------+     +------+     +------+
| HTTP |---->| Auth |---->| DB   |
+------+     +------+     +------+
```

````markdown
```kroki ditaa
+----------+
| Plan  {d}|
+----------+
```
````

```kroki ditaa
+----------+
| Plan  {d}|
+----------+
```

````markdown
```kroki ditaa
+-----------+
| {c} API   |
+-----------+
```
````

```kroki ditaa
+-----------+
| {c} API   |
+-----------+
```

````markdown
```kroki ditaa
+------------+
| Queue   {s}|
+------------+
```
````

```kroki ditaa
+------------+
| Queue   {s}|
+------------+
```

````markdown
```kroki ditaa
+------------+
| Web Server |
| port 8080  |
+------------+
```
````

```kroki ditaa
+------------+
| Web Server |
| port 8080  |
+------------+
```

````markdown
```kroki ditaa
+--------+      +--------+
| Client |----->| Server |
+--------+      +--------+
                     |
                     v
                 +--------+
                 |   DB   |
                 +--------+
```
````

```kroki ditaa
+--------+      +--------+
| Client |----->| Server |
+--------+      +--------+
                     |
                     v
                 +--------+
                 |   DB   |
                 +--------+
```

````markdown
```kroki ditaa
+------+      +------+
| Core |----->| App1 |
+------+      +------+
    |
    |         +------+
    +-------->| App2 |
              +------+
```
````

```kroki ditaa
+------+      +------+
| Core |----->| App1 |
+------+      +------+
    |
    |         +------+
    +-------->| App2 |
              +------+
```

````markdown
```kroki ditaa
/-------\      /-------\
| Start |----->|  End  |
\-------/      \-------/
```
````

```kroki ditaa
/-------\      /-------\
| Start |----->|  End  |
\-------/      \-------/
```

### erd — 实体关系图

````markdown
```kroki erd
[Person]
*name
height
weight
+birth_location_id
[Location]
*id
city
state
Person *--1 Location
```
````

```kroki erd
[Person]
*name
height
weight
+birth_location_id
[Location]
*id
city
state
Person *--1 Location
```

````markdown
```kroki erd
[User]
*id
email
password_hash
[Profile]
*id
bio
User 1--1 Profile
```
````

```kroki erd
[User]
*id
email
password_hash
[Profile]
*id
bio
User 1--1 Profile
```

````markdown
```kroki erd
[Student]
*id
name
[Course]
*id
title
Student *--* Course
```
````

```kroki erd
[Student]
*id
name
[Course]
*id
title
Student *--* Course
```

````markdown
```kroki erd
[Account]
*id
email
[Session]
*token
created_at
Account ?--1 Session
```
````

```kroki erd
[Account]
*id
email
[Session]
*token
created_at
Account ?--1 Session
```

````markdown
```kroki erd
[Customer]
*id
name
[Order]
*id
total
[Payment]
*id
amount
Customer *--1 Order
Order 1--1 Payment
```
````

```kroki erd
[Customer]
*id
name
[Order]
*id
total
[Payment]
*id
amount
Customer *--1 Order
Order 1--1 Payment
```

````markdown
```kroki erd
[Order]
*id
*line_no
sku
qty
[Product]
*id
name
Order *--1 Product
```
````

```kroki erd
[Order]
*id
*line_no
sku
qty
[Product]
*id
name
Order *--1 Product
```

````markdown
```kroki erd
[Employee]
*id
name
+dept_id
[Department]
*id
name
Employee *--1 Department
```
````

```kroki erd
[Employee]
*id
name
+dept_id
[Department]
*id
name
Employee *--1 Department
```

````markdown
```kroki erd
[Team]
*id
name
[Member]
*id
role
[Task]
*id
title
Team *--1 Member
Team *--1 Task
```
````

```kroki erd
[Team]
*id
name
[Member]
*id
role
[Task]
*id
title
Team *--1 Member
Team *--1 Task
```

````markdown
```kroki erd
[Hub]
*id
[NodeA]
*id
[NodeB]
*id
[NodeC]
*id
Hub *--1 NodeA
Hub *--1 NodeB
Hub *--1 NodeC
```
````

```kroki erd
[Hub]
*id
[NodeA]
*id
[NodeB]
*id
[NodeC]
*id
Hub *--1 NodeA
Hub *--1 NodeB
Hub *--1 NodeC
```

````markdown
```kroki erd
[Invoice]
*id
issued_at
[LineItem]
*id
qty
[TaxRate]
*id
rate
Invoice *--1 LineItem
LineItem 1--1 TaxRate
```
````

```kroki erd
[Invoice]
*id
issued_at
[LineItem]
*id
qty
[TaxRate]
*id
rate
Invoice *--1 LineItem
LineItem 1--1 TaxRate
```

### graphviz — 有向关系图

````markdown
```kroki graphviz
digraph G {
  A -> B;
  B -> C;
}
```
````

```kroki graphviz
digraph G {
  A -> B;
  B -> C;
}
```

````markdown
```kroki graphviz
digraph G {
  rankdir = LR;
  client -> gateway;
  gateway -> service;
  service -> db;
}
```
````

```kroki graphviz
digraph G {
  rankdir = LR;
  client -> gateway;
  gateway -> service;
  service -> db;
}
```

````markdown
```kroki graphviz
digraph G {
  node [shape = box, style = rounded];
  A [color = "#cc0000"];
  B [color = "#0066cc"];
  A -> B;
}
```
````

```kroki graphviz
digraph G {
  node [shape = box, style = rounded];
  A [color = "#cc0000"];
  B [color = "#0066cc"];
  A -> B;
}
```

````markdown
```kroki graphviz
digraph G {
  subgraph cluster_web {
    label = "Web";
    ui;
    api;
  }
  db;
  cache;
  ui -> api;
  api -> db;
  api -> cache;
}
```
````

```kroki graphviz
digraph G {
  subgraph cluster_web {
    label = "Web";
    ui;
    api;
  }
  db;
  cache;
  ui -> api;
  api -> db;
  api -> cache;
}
```

````markdown
```kroki graphviz
digraph G {
  A -> B [label = "request"];
  B -> C [label = "query"];
  C -> B [label = "rows"];
}
```
````

```kroki graphviz
digraph G {
  A -> B [label = "request"];
  B -> C [label = "query"];
  C -> B [label = "rows"];
}
```

````markdown
```kroki graphviz
digraph G {
  A -> B [style = dashed];
  B -> C [style = dotted, color = blue];
  C -> A [style = bold];
}
```
````

```kroki graphviz
digraph G {
  A -> B [style = dashed];
  B -> C [style = dotted, color = blue];
  C -> A [style = bold];
}
```

````markdown
```kroki graphviz
digraph G {
  start [shape = circle];
  check [shape = diamond];
  ok [shape = box];
  start -> check;
  check -> ok [label = "yes"];
  check -> start [label = "no"];
}
```
````

```kroki graphviz
digraph G {
  start [shape = circle];
  check [shape = diamond];
  ok [shape = box];
  start -> check;
  check -> ok [label = "yes"];
  check -> start [label = "no"];
}
```

````markdown
```kroki graphviz
digraph G {
  packet [shape = record, label = "{Header|Payload|CRC}"];
  packet -> wire;
}
```
````

```kroki graphviz
digraph G {
  packet [shape = record, label = "{Header|Payload|CRC}"];
  packet -> wire;
}
```

````markdown
```kroki graphviz
digraph G {
  rankdir = TB;
  splines = ortho;
  A -> B;
  A -> C;
  B -> D;
  C -> D;
}
```
````

```kroki graphviz
digraph G {
  rankdir = TB;
  splines = ortho;
  A -> B;
  A -> C;
  B -> D;
  C -> D;
}
```

````markdown
```kroki graphviz
digraph G {
  subgraph cluster_a {
    label = "Client";
    browser;
  }
  subgraph cluster_b {
    label = "Server";
    app; db;
  }
  browser -> app [label = "HTTPS"];
  app -> db;
}
```
````

```kroki graphviz
digraph G {
  subgraph cluster_a {
    label = "Client";
    browser;
  }
  subgraph cluster_b {
    label = "Server";
    app; db;
  }
  browser -> app [label = "HTTPS"];
  app -> db;
}
```

### nomnoml — 轻量 UML 图

````markdown
```kroki nomnoml
[A] -> [B] -> [C]
```
````

```kroki nomnoml
[A] -> [B] -> [C]
```

````markdown
```kroki nomnoml
[<actor> User] -> [<usecase> Login]
[<usecase> Login] -> [<database> Users]
```
````

```kroki nomnoml
[<actor> User] -> [<usecase> Login]
[<usecase> Login] -> [<database> Users]
```

````markdown
```kroki nomnoml
[User|+name;+email|login();logout()]
```
````

```kroki nomnoml
[User|+name;+email|login();logout()]
```

````markdown
```kroki nomnoml
[<abstract> Shape] <:- [Circle]
[<abstract> Shape] <:- [Square]
```
````

```kroki nomnoml
[<abstract> Shape] <:- [Circle]
[<abstract> Shape] <:- [Square]
```

````markdown
```kroki nomnoml
[Service] -> [<note> retries 3 times]
```
````

```kroki nomnoml
[Service] -> [<note> retries 3 times]
```

````markdown
```kroki nomnoml
[<package> Web|[UI] -> [API]]
```
````

```kroki nomnoml
[<package> Web|[UI] -> [API]]
```

````markdown
```kroki nomnoml
#direction: right
#title: Request flow
[Browser] -> [Gateway]
[Gateway] -> [Service]
```
````

```kroki nomnoml
#direction: right
#title: Request flow
[Browser] -> [Gateway]
[Gateway] -> [Service]
```

````markdown
```kroki nomnoml
#fill: #eef4ff
#stroke: #336699
[Box] -> [Other]
```
````

```kroki nomnoml
#fill: #eef4ff
#stroke: #336699
[Box] -> [Other]
```

````markdown
```kroki nomnoml
[Gateway] -> [Auth]
[Gateway] -> [Orders]
[Gateway] -> [Search]
```
````

```kroki nomnoml
[Gateway] -> [Auth]
[Gateway] -> [Orders]
[Gateway] -> [Search]
```

````markdown
```kroki nomnoml
[<package> App|
  [UI] -> [Core]
  [Core] -> [<database> DB]
]
```
````

```kroki nomnoml
[<package> App|
  [UI] -> [Core]
  [Core] -> [<database> DB]
]
```

### svgbob — ASCII 转矢量图

````markdown
```kroki svgbob
+-------+     +--------+
| Input |---->| Output |
+-------+     +--------+
```
````

```kroki svgbob
+-------+     +--------+
| Input |---->| Output |
+-------+     +--------+
```

````markdown
```kroki svgbob
+-------+
| Start |
+-------+
    |
    v
+-------+
| Done  |
+-------+
```
````

```kroki svgbob
+-------+
| Start |
+-------+
    |
    v
+-------+
| Done  |
+-------+
```

````markdown
```kroki svgbob
+------+   hello   +------+
| User | --------> | App  |
+------+           +------+
```
````

```kroki svgbob
+------+   hello   +------+
| User | --------> | App  |
+------+           +------+
```

````markdown
```kroki svgbob
        +---------+
        |  check  |
        +---------+
           /   \
      yes /     \ no
         v       v
   +-------+   +-------+
   |  ok   |   | fail  |
   +-------+   +-------+
```
````

```kroki svgbob
        +---------+
        |  check  |
        +---------+
           /   \
      yes /     \ no
         v       v
   +-------+   +-------+
   |  ok   |   | fail  |
   +-------+   +-------+
```

````markdown
```kroki svgbob
+------+------+
| Name | Age  |
+------+------+
| Bob  | 42   |
| Ann  | 36   |
+------+------+
```
````

```kroki svgbob
+------+------+
| Name | Age  |
+------+------+
| Bob  | 42   |
| Ann  | 36   |
+------+------+
```

````markdown
```kroki svgbob
+ - - - - +
|  draft  |
+ - - - - +
```
````

```kroki svgbob
+ - - - - +
|  draft  |
+ - - - - +
```

````markdown
```kroki svgbob
.---------.
|  card   |
'---------'
```
````

```kroki svgbob
.---------.
|  card   |
'---------'
```

````markdown
```kroki svgbob
      +------+
      | root |
      +------+
       /    \
      /      \
+------+    +-------+
| left |    | right |
+------+    +-------+
```
````

```kroki svgbob
      +------+
      | root |
      +------+
       /    \
      /      \
+------+    +-------+
| left |    | right |
+------+    +-------+
```

````markdown
```kroki svgbob
 Alice         Bob
   |   ping    |
   |---------->|
   |<----------|
   |   pong    |
```
````

```kroki svgbob
 Alice         Bob
   |   ping    |
   |---------->|
   |<----------|
   |   pong    |
```

````markdown
```kroki svgbob
+----------------+
| outer          |
|  +----------+  |
|  |  inner   |  |
|  +----------+  |
+----------------+
```
````

```kroki svgbob
+----------------+
| outer          |
|  +----------+  |
|  |  inner   |  |
|  +----------+  |
+----------------+
```

### umlet — UML 元素图

````markdown
```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Class</type><coordinates><x>10</x><y>10</y><w>180</w><h>100</h></coordinates>
    <panel_attributes>User
--
+id: int
+name: String</panel_attributes>
  </element>
</umlet_diagram>
```
````

```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Class</type><coordinates><x>10</x><y>10</y><w>180</w><h>100</h></coordinates>
    <panel_attributes>User
--
+id: int
+name: String</panel_attributes>
  </element>
</umlet_diagram>
```

````markdown
```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Class</type><coordinates><x>10</x><y>10</y><w>190</w><h>90</h></coordinates>
    <panel_attributes>Service
--
+run(): void
+stop(): void</panel_attributes>
  </element>
</umlet_diagram>
```
````

```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Class</type><coordinates><x>10</x><y>10</y><w>190</w><h>90</h></coordinates>
    <panel_attributes>Service
--
+run(): void
+stop(): void</panel_attributes>
  </element>
</umlet_diagram>
```

````markdown
```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Interface</type><coordinates><x>10</x><y>10</y><w>200</w><h>90</h></coordinates>
    <panel_attributes>Repository
--
+find(id): Item</panel_attributes>
  </element>
</umlet_diagram>
```
````

```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Interface</type><coordinates><x>10</x><y>10</y><w>200</w><h>90</h></coordinates>
    <panel_attributes>Repository
--
+find(id): Item</panel_attributes>
  </element>
</umlet_diagram>
```

````markdown
```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Note</type><coordinates><x>10</x><y>10</y><w>220</w><h>80</h></coordinates>
    <panel_attributes>retry up to 3 times</panel_attributes>
  </element>
</umlet_diagram>
```
````

```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Note</type><coordinates><x>10</x><y>10</y><w>220</w><h>80</h></coordinates>
    <panel_attributes>retry up to 3 times</panel_attributes>
  </element>
</umlet_diagram>
```

````markdown
```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Actor</type><coordinates><x>10</x><y>10</y><w>90</w><h>120</h></coordinates>
    <panel_attributes>User</panel_attributes>
  </element>
</umlet_diagram>
```
````

```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Actor</type><coordinates><x>10</x><y>10</y><w>90</w><h>120</h></coordinates>
    <panel_attributes>User</panel_attributes>
  </element>
</umlet_diagram>
```

````markdown
```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.UseCase</type><coordinates><x>10</x><y>10</y><w>180</w><h>80</h></coordinates>
    <panel_attributes>Login</panel_attributes>
  </element>
</umlet_diagram>
```
````

```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.UseCase</type><coordinates><x>10</x><y>10</y><w>180</w><h>80</h></coordinates>
    <panel_attributes>Login</panel_attributes>
  </element>
</umlet_diagram>
```

````markdown
```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Package</type><coordinates><x>10</x><y>10</y><w>200</w><h>100</h></coordinates>
    <panel_attributes>core</panel_attributes>
  </element>
</umlet_diagram>
```
````

```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Package</type><coordinates><x>10</x><y>10</y><w>200</w><h>100</h></coordinates>
    <panel_attributes>core</panel_attributes>
  </element>
</umlet_diagram>
```

````markdown
```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Component</type><coordinates><x>10</x><y>10</y><w>200</w><h>80</h></coordinates>
    <panel_attributes>api</panel_attributes>
  </element>
</umlet_diagram>
```
````

```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Component</type><coordinates><x>10</x><y>10</y><w>200</w><h>80</h></coordinates>
    <panel_attributes>api</panel_attributes>
  </element>
</umlet_diagram>
```

````markdown
```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Class</type><coordinates><x>0</x><y>0</y><w>120</w><h>60</h></coordinates><panel_attributes>Order</panel_attributes>
  </element>
  <element>
    <type>com.umlet.element.base.Class</type><coordinates><x>260</x><y>0</y><w>120</w><h>60</h></coordinates><panel_attributes>Customer</panel_attributes>
  </element>
  <element>
    <type>com.umlet.element.base.Relation</type><coordinates><x>0</x><y>0</y><w>260</w><h>140</h></coordinates><panel_attributes>lt=-&gt;</panel_attributes>
    <additional_attributes>120;30;260;30</additional_attributes>
  </element>
</umlet_diagram>
```
````

```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Class</type><coordinates><x>0</x><y>0</y><w>120</w><h>60</h></coordinates><panel_attributes>Order</panel_attributes>
  </element>
  <element>
    <type>com.umlet.element.base.Class</type><coordinates><x>260</x><y>0</y><w>120</w><h>60</h></coordinates><panel_attributes>Customer</panel_attributes>
  </element>
  <element>
    <type>com.umlet.element.base.Relation</type><coordinates><x>0</x><y>0</y><w>260</w><h>140</h></coordinates><panel_attributes>lt=-&gt;</panel_attributes>
    <additional_attributes>120;30;260;30</additional_attributes>
  </element>
</umlet_diagram>
```

````markdown
```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Class</type><coordinates><x>0</x><y>0</y><w>140</w><h>60</h></coordinates><panel_attributes>Client</panel_attributes>
  </element>
  <element>
    <type>com.umlet.element.base.Class</type><coordinates><x>0</x><y>160</y><w>140</w><h>60</h></coordinates><panel_attributes>Server</panel_attributes>
  </element>
  <element>
    <type>com.umlet.element.base.Relation</type><coordinates><x>0</x><y>0</y><w>140</w><h>220</h></coordinates><panel_attributes>lt=-&gt;</panel_attributes>
    <additional_attributes>70;60;70;160</additional_attributes>
  </element>
</umlet_diagram>
```
````

```kroki umlet
<umlet_diagram>
  <element>
    <type>com.umlet.element.base.Class</type><coordinates><x>0</x><y>0</y><w>140</w><h>60</h></coordinates><panel_attributes>Client</panel_attributes>
  </element>
  <element>
    <type>com.umlet.element.base.Class</type><coordinates><x>0</x><y>160</y><w>140</w><h>60</h></coordinates><panel_attributes>Server</panel_attributes>
  </element>
  <element>
    <type>com.umlet.element.base.Relation</type><coordinates><x>0</x><y>0</y><w>140</w><h>220</h></coordinates><panel_attributes>lt=-&gt;</panel_attributes>
    <additional_attributes>70;60;70;160</additional_attributes>
  </element>
</umlet_diagram>
```

## Vega-Lite

**源码**（JSON 规范；渲染 treemap / density / facet / transform 等 ApexCharts 覆盖不到的图，vega 系列按需从 CDN 懒加载）：

````markdown
```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "A simple bar chart",
  "data": {
    "values": [
      {"category": "A", "value": 28},
      {"category": "B", "value": 55},
      {"category": "C", "value": 43},
      {"category": "D", "value": 91},
      {"category": "E", "value": 81}
    ]
  },
  "mark": {"type": "bar"},
  "encoding": {
    "x": {"field": "category", "type": "nominal", "axis": {"labelAngle": 0}},
    "y": {"field": "value", "type": "quantitative"}
  }
}
```
````

**渲染效果**：

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "A simple bar chart",
  "data": {
    "values": [
      {"category": "A", "value": 28},
      {"category": "B", "value": 55},
      {"category": "C", "value": 43},
      {"category": "D", "value": 91},
      {"category": "E", "value": 81}
    ]
  },
  "mark": {"type": "bar"},
  "encoding": {
    "x": {"field": "category", "type": "nominal", "axis": {"labelAngle": 0}},
    "y": {"field": "value", "type": "quantitative"}
  }
}
```

### 堆叠条形图（按区域分组）

**源码**：

````markdown
```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Stacked bar chart by region",
  "data": {
    "values": [
      {"region": "华东", "quarter": "Q1", "amount": 120},
      {"region": "华东", "quarter": "Q2", "amount": 165},
      {"region": "华北", "quarter": "Q1", "amount": 98},
      {"region": "华北", "quarter": "Q2", "amount": 143},
      {"region": "华南", "quarter": "Q1", "amount": 76},
      {"region": "华南", "quarter": "Q2", "amount": 112}
    ]
  },
  "mark": {"type": "bar"},
  "encoding": {
    "x": {"field": "quarter", "type": "nominal", "axis": {"title": null}},
    "y": {"field": "amount", "type": "quantitative", "axis": {"title": null}},
    "color": {"field": "region", "type": "nominal"},
    "xOffset": {"field": "region"}
  }
}
```
````

**渲染效果**：

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Stacked bar chart by region",
  "data": {
    "values": [
      {"region": "华东", "quarter": "Q1", "amount": 120},
      {"region": "华东", "quarter": "Q2", "amount": 165},
      {"region": "华北", "quarter": "Q1", "amount": 98},
      {"region": "华北", "quarter": "Q2", "amount": 143},
      {"region": "华南", "quarter": "Q1", "amount": 76},
      {"region": "华南", "quarter": "Q2", "amount": 112}
    ]
  },
  "mark": {"type": "bar"},
  "encoding": {
    "x": {"field": "quarter", "type": "nominal", "axis": {"title": null}},
    "y": {"field": "amount", "type": "quantitative", "axis": {"title": null}},
    "color": {"field": "region", "type": "nominal"},
    "xOffset": {"field": "region"}
  }
}
```

### 折线图（多序列 + 数据点）

**源码**：

````markdown
```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Multi-series line chart",
  "data": {
    "values": [
      {"month": "1月", "core01": 42, "core02": 35},
      {"month": "2月", "core01": 51, "core02": 39},
      {"month": "3月", "core01": 47, "core02": 55},
      {"month": "4月", "core01": 63, "core02": 58},
      {"month": "5月", "core01": 59, "core02": 71},
      {"month": "6月", "core01": 74, "core02": 66}
    ]
  },
  "mark": {"type": "line", "point": true},
  "encoding": {
    "x": {"field": "month", "type": "ordinal", "axis": {"title": null}},
    "y": {"field": "value", "type": "quantitative", "axis": {"title": null}},
    "color": {"field": "key", "type": "nominal"}
  }
}
```
````

**渲染效果**：

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Multi-series line chart",
  "data": {
    "values": [
      {"month": "1月", "core01": 42, "core02": 35},
      {"month": "2月", "core01": 51, "core02": 39},
      {"month": "3月", "core01": 47, "core02": 55},
      {"month": "4月", "core01": 63, "core02": 58},
      {"month": "5月", "core01": 59, "core02": 71},
      {"month": "6月", "core01": 74, "core02": 66}
    ]
  },
  "mark": {"type": "line", "point": true},
  "encoding": {
    "x": {"field": "month", "type": "ordinal", "axis": {"title": null}},
    "y": {"field": "value", "type": "quantitative", "axis": {"title": null}},
    "color": {"field": "key", "type": "nominal"}
  }
}
```

服务失败或离线时两者都会回退为源码 + 在线打开链接；错误响应（如 400）也会触发回退而不是把错误图当结果展示。

### 散点图 + 线性回归

**源码**：

````markdown
```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"x": 1, "y": 2.1}, {"x": 2, "y": 3.4}, {"x": 3, "y": 4.2}, {"x": 4, "y": 6.8}, {"x": 5, "y": 7.1}, {"x": 6, "y": 8.6}, {"x": 7, "y": 9.9}]}, "layer": [{"mark": {"type": "point", "filled": true, "size": 80}, "encoding": {"x": {"field": "x", "type": "quantitative", "title": "样本"}, "y": {"field": "y", "type": "quantitative", "title": "响应值"}, "tooltip": true}}, {"mark": {"type": "line", "color": "#c0392b", "strokeWidth": 2}, "transform": [{"regression": "y", "on": "x"}], "encoding": {"x": {"field": "x", "type": "quantitative"}, "y": {"field": "y", "type": "quantitative"}}}]}
```
````

**渲染效果**：

```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"x": 1, "y": 2.1}, {"x": 2, "y": 3.4}, {"x": 3, "y": 4.2}, {"x": 4, "y": 6.8}, {"x": 5, "y": 7.1}, {"x": 6, "y": 8.6}, {"x": 7, "y": 9.9}]}, "layer": [{"mark": {"type": "point", "filled": true, "size": 80}, "encoding": {"x": {"field": "x", "type": "quantitative", "title": "样本"}, "y": {"field": "y", "type": "quantitative", "title": "响应值"}, "tooltip": true}}, {"mark": {"type": "line", "color": "#c0392b", "strokeWidth": 2}, "transform": [{"regression": "y", "on": "x"}], "encoding": {"x": {"field": "x", "type": "quantitative"}, "y": {"field": "y", "type": "quantitative"}}}]}
```

### 时间序列面积图

**源码**：

````markdown
```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"date": "2026-01-01", "value": 12}, {"date": "2026-02-01", "value": 18}, {"date": "2026-03-01", "value": 15}, {"date": "2026-04-01", "value": 26}, {"date": "2026-05-01", "value": 31}, {"date": "2026-06-01", "value": 29}]}, "mark": {"type": "area", "line": {"color": "#8B5CF6"}, "color": {"gradient": "linear", "stops": [{"offset": 0, "color": "#8B5CF6"}, {"offset": 1, "color": "#ffffff"}]}}, "encoding": {"x": {"field": "date", "type": "temporal", "title": "月份", "axis": {"format": "%m月"}}, "y": {"field": "value", "type": "quantitative", "title": "访问量"}, "tooltip": [{"field": "date", "type": "temporal", "format": "%Y-%m"}, {"field": "value", "type": "quantitative"}]}}
```
````

**渲染效果**：

```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"date": "2026-01-01", "value": 12}, {"date": "2026-02-01", "value": 18}, {"date": "2026-03-01", "value": 15}, {"date": "2026-04-01", "value": 26}, {"date": "2026-05-01", "value": 31}, {"date": "2026-06-01", "value": 29}]}, "mark": {"type": "area", "line": {"color": "#8B5CF6"}, "color": {"gradient": "linear", "stops": [{"offset": 0, "color": "#8B5CF6"}, {"offset": 1, "color": "#ffffff"}]}}, "encoding": {"x": {"field": "date", "type": "temporal", "title": "月份", "axis": {"format": "%m月"}}, "y": {"field": "value", "type": "quantitative", "title": "访问量"}, "tooltip": [{"field": "date", "type": "temporal", "format": "%Y-%m"}, {"field": "value", "type": "quantitative"}]}}
```

### 环形图

**源码**：

````markdown
```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"proto": "TCP", "n": 48}, {"proto": "UDP", "n": 21}, {"proto": "ICMP", "n": 9}, {"proto": "ARP", "n": 6}]}, "mark": {"type": "arc", "innerRadius": 55, "outerRadius": 100, "stroke": "#fff"}, "encoding": {"theta": {"field": "n", "type": "quantitative", "stack": true}, "color": {"field": "proto", "type": "nominal", "scale": {"scheme": "tableau10"}, "title": "协议"}, "tooltip": [{"field": "proto", "type": "nominal"}, {"field": "n", "type": "quantitative"}]}}
```
````

**渲染效果**：

```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"proto": "TCP", "n": 48}, {"proto": "UDP", "n": 21}, {"proto": "ICMP", "n": 9}, {"proto": "ARP", "n": 6}]}, "mark": {"type": "arc", "innerRadius": 55, "outerRadius": 100, "stroke": "#fff"}, "encoding": {"theta": {"field": "n", "type": "quantitative", "stack": true}, "color": {"field": "proto", "type": "nominal", "scale": {"scheme": "tableau10"}, "title": "协议"}, "tooltip": [{"field": "proto", "type": "nominal"}, {"field": "n", "type": "quantitative"}]}}
```

### 直方图（自动分箱）

**源码**：

````markdown
```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"lat": 12}, {"lat": 18}, {"lat": 18}, {"lat": 21}, {"lat": 24}, {"lat": 24}, {"lat": 26}, {"lat": 31}, {"lat": 35}, {"lat": 35}, {"lat": 39}, {"lat": 42}, {"lat": 47}, {"lat": 52}, {"lat": 58}, {"lat": 63}]}, "mark": {"type": "bar", "color": "#8B5CF6"}, "encoding": {"x": {"field": "lat", "type": "quantitative", "bin": {"maxbins": 8}, "title": "RTT (ms)"}, "y": {"aggregate": "count", "type": "quantitative", "title": "次数"}}}
```
````

**渲染效果**：

```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"lat": 12}, {"lat": 18}, {"lat": 18}, {"lat": 21}, {"lat": 24}, {"lat": 24}, {"lat": 26}, {"lat": 31}, {"lat": 35}, {"lat": 35}, {"lat": 39}, {"lat": 42}, {"lat": 47}, {"lat": 52}, {"lat": 58}, {"lat": 63}]}, "mark": {"type": "bar", "color": "#8B5CF6"}, "encoding": {"x": {"field": "lat", "type": "quantitative", "bin": {"maxbins": 8}, "title": "RTT (ms)"}, "y": {"aggregate": "count", "type": "quantitative", "title": "次数"}}}
```

### 箱线图

**源码**：

````markdown
```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"site": "A", "v": 12}, {"site": "A", "v": 15}, {"site": "A", "v": 18}, {"site": "A", "v": 22}, {"site": "A", "v": 31}, {"site": "B", "v": 8}, {"site": "B", "v": 14}, {"site": "B", "v": 17}, {"site": "B", "v": 20}, {"site": "B", "v": 45}, {"site": "C", "v": 21}, {"site": "C", "v": 24}, {"site": "C", "v": 27}, {"site": "C", "v": 30}, {"site": "C", "v": 33}]}, "mark": {"type": "boxplot", "extent": "min-max"}, "encoding": {"x": {"field": "site", "type": "nominal", "title": "站点"}, "y": {"field": "v", "type": "quantitative", "title": "响应时间 (ms)"}, "color": {"field": "site", "type": "nominal", "legend": null}}}
```
````

**渲染效果**：

```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"site": "A", "v": 12}, {"site": "A", "v": 15}, {"site": "A", "v": 18}, {"site": "A", "v": 22}, {"site": "A", "v": 31}, {"site": "B", "v": 8}, {"site": "B", "v": 14}, {"site": "B", "v": 17}, {"site": "B", "v": 20}, {"site": "B", "v": 45}, {"site": "C", "v": 21}, {"site": "C", "v": 24}, {"site": "C", "v": 27}, {"site": "C", "v": 30}, {"site": "C", "v": 33}]}, "mark": {"type": "boxplot", "extent": "min-max"}, "encoding": {"x": {"field": "site", "type": "nominal", "title": "站点"}, "y": {"field": "v", "type": "quantitative", "title": "响应时间 (ms)"}, "color": {"field": "site", "type": "nominal", "legend": null}}}
```

### 热力图

**源码**：

````markdown
```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"day": "周一", "hour": "0-6", "v": 3}, {"day": "周一", "hour": "6-12", "v": 12}, {"day": "周一", "hour": "12-18", "v": 18}, {"day": "周一", "hour": "18-24", "v": 9}, {"day": "周二", "hour": "0-6", "v": 4}, {"day": "周二", "hour": "6-12", "v": 15}, {"day": "周二", "hour": "12-18", "v": 21}, {"day": "周二", "hour": "18-24", "v": 11}, {"day": "周三", "hour": "0-6", "v": 2}, {"day": "周三", "hour": "6-12", "v": 10}, {"day": "周三", "hour": "12-18", "v": 16}, {"day": "周三", "hour": "18-24", "v": 7}]}, "mark": "rect", "encoding": {"x": {"field": "hour", "type": "ordinal", "title": "时段"}, "y": {"field": "day", "type": "ordinal", "title": null}, "color": {"field": "v", "type": "quantitative", "scale": {"scheme": "purples"}, "title": "请求"}, "tooltip": true}}
```
````

**渲染效果**：

```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"day": "周一", "hour": "0-6", "v": 3}, {"day": "周一", "hour": "6-12", "v": 12}, {"day": "周一", "hour": "12-18", "v": 18}, {"day": "周一", "hour": "18-24", "v": 9}, {"day": "周二", "hour": "0-6", "v": 4}, {"day": "周二", "hour": "6-12", "v": 15}, {"day": "周二", "hour": "12-18", "v": 21}, {"day": "周二", "hour": "18-24", "v": 11}, {"day": "周三", "hour": "0-6", "v": 2}, {"day": "周三", "hour": "6-12", "v": 10}, {"day": "周三", "hour": "12-18", "v": 16}, {"day": "周三", "hour": "18-24", "v": 7}]}, "mark": "rect", "encoding": {"x": {"field": "hour", "type": "ordinal", "title": "时段"}, "y": {"field": "day", "type": "ordinal", "title": null}, "color": {"field": "v", "type": "quantitative", "scale": {"scheme": "purples"}, "title": "请求"}, "tooltip": true}}
```

### 堆叠面积图

**源码**：

````markdown
```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"m": "1月", "kind": "入站", "v": 32}, {"m": "1月", "kind": "出站", "v": 21}, {"m": "2月", "kind": "入站", "v": 41}, {"m": "2月", "kind": "出站", "v": 26}, {"m": "3月", "kind": "入站", "v": 38}, {"m": "3月", "kind": "出站", "v": 31}, {"m": "4月", "kind": "入站", "v": 52}, {"m": "4月", "kind": "出站", "v": 36}]}, "mark": {"type": "area", "interpolate": "monotone"}, "encoding": {"x": {"field": "m", "type": "ordinal", "title": null}, "y": {"field": "v", "type": "quantitative", "stack": "zero", "title": "流量 (Gbps)"}, "color": {"field": "kind", "type": "nominal", "scale": {"range": ["#8B5CF6", "#EC4899"]}}, "tooltip": true}}
```
````

**渲染效果**：

```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"m": "1月", "kind": "入站", "v": 32}, {"m": "1月", "kind": "出站", "v": 21}, {"m": "2月", "kind": "入站", "v": 41}, {"m": "2月", "kind": "出站", "v": 26}, {"m": "3月", "kind": "入站", "v": 38}, {"m": "3月", "kind": "出站", "v": 31}, {"m": "4月", "kind": "入站", "v": 52}, {"m": "4月", "kind": "出站", "v": 36}]}, "mark": {"type": "area", "interpolate": "monotone"}, "encoding": {"x": {"field": "m", "type": "ordinal", "title": null}, "y": {"field": "v", "type": "quantitative", "stack": "zero", "title": "流量 (Gbps)"}, "color": {"field": "kind", "type": "nominal", "scale": {"range": ["#8B5CF6", "#EC4899"]}}, "tooltip": true}}
```

### 分面小多图

**源码**：

````markdown
```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"site": "北京", "h": 0, "v": 12}, {"site": "北京", "h": 6, "v": 28}, {"site": "北京", "h": 12, "v": 34}, {"site": "北京", "h": 18, "v": 19}, {"site": "上海", "h": 0, "v": 9}, {"site": "上海", "h": 6, "v": 22}, {"site": "上海", "h": 12, "v": 41}, {"site": "上海", "h": 18, "v": 25}, {"site": "广州", "h": 0, "v": 7}, {"site": "广州", "h": 6, "v": 18}, {"site": "广州", "h": 12, "v": 29}, {"site": "广州", "h": 18, "v": 21}]}, "facet": {"column": {"field": "site", "type": "nominal", "title": null}}, "spec": {"width": 120, "height": 90, "mark": {"type": "line", "point": true, "color": "#8B5CF6"}, "encoding": {"x": {"field": "h", "type": "quantitative", "title": "小时"}, "y": {"field": "v", "type": "quantitative", "title": "QPS"}}}}
```
````

**渲染效果**：

```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"site": "北京", "h": 0, "v": 12}, {"site": "北京", "h": 6, "v": 28}, {"site": "北京", "h": 12, "v": 34}, {"site": "北京", "h": 18, "v": 19}, {"site": "上海", "h": 0, "v": 9}, {"site": "上海", "h": 6, "v": 22}, {"site": "上海", "h": 12, "v": 41}, {"site": "上海", "h": 18, "v": 25}, {"site": "广州", "h": 0, "v": 7}, {"site": "广州", "h": 6, "v": 18}, {"site": "广州", "h": 12, "v": 29}, {"site": "广州", "h": 18, "v": 21}]}, "facet": {"column": {"field": "site", "type": "nominal", "title": null}}, "spec": {"width": 120, "height": 90, "mark": {"type": "line", "point": true, "color": "#8B5CF6"}, "encoding": {"x": {"field": "h", "type": "quantitative", "title": "小时"}, "y": {"field": "v", "type": "quantitative", "title": "QPS"}}}}
```

### 悬停选择高亮

**源码**：

````markdown
```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"a": 12, "b": 19, "g": "A"}, {"a": 21, "b": 14, "g": "A"}, {"a": 17, "b": 26, "g": "B"}, {"a": 28, "b": 31, "g": "B"}, {"a": 33, "b": 22, "g": "C"}, {"a": 25, "b": 36, "g": "C"}]}, "params": [{"name": "hover", "select": {"type": "point", "on": "pointerover", "clear": "pointerout"}}], "mark": {"type": "point", "filled": true, "size": 120}, "encoding": {"x": {"field": "a", "type": "quantitative"}, "y": {"field": "b", "type": "quantitative"}, "color": {"condition": {"param": "hover", "field": "g", "type": "nominal", "scale": {"scheme": "tableau10"}}, "value": "#b9b9c3"}, "tooltip": true}}
```
````

**渲染效果**：

```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"a": 12, "b": 19, "g": "A"}, {"a": 21, "b": 14, "g": "A"}, {"a": 17, "b": 26, "g": "B"}, {"a": 28, "b": 31, "g": "B"}, {"a": 33, "b": 22, "g": "C"}, {"a": 25, "b": 36, "g": "C"}]}, "params": [{"name": "hover", "select": {"type": "point", "on": "pointerover", "clear": "pointerout"}}], "mark": {"type": "point", "filled": true, "size": 120}, "encoding": {"x": {"field": "a", "type": "quantitative"}, "y": {"field": "b", "type": "quantitative"}, "color": {"condition": {"param": "hover", "field": "g", "type": "nominal", "scale": {"scheme": "tableau10"}}, "value": "#b9b9c3"}, "tooltip": true}}
```

### 滑动条参数过滤

**源码**：

````markdown
```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"m": "1月", "v": 12}, {"m": "2月", "v": 18}, {"m": "3月", "v": 15}, {"m": "4月", "v": 26}, {"m": "5月", "v": 31}, {"m": "6月", "v": 29}]}, "params": [{"name": "cut", "value": 20, "bind": {"input": "range", "min": 0, "max": 35, "step": 1, "name": "阈值 "}}], "transform": [{"filter": "datum.v >= cut"}], "mark": {"type": "bar", "color": "#8B5CF6"}, "encoding": {"x": {"field": "m", "type": "ordinal", "title": null}, "y": {"field": "v", "type": "quantitative", "title": "访问量"}}}
```
````

**渲染效果**：

```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"m": "1月", "v": 12}, {"m": "2月", "v": 18}, {"m": "3月", "v": 15}, {"m": "4月", "v": 26}, {"m": "5月", "v": 31}, {"m": "6月", "v": 29}]}, "params": [{"name": "cut", "value": 20, "bind": {"input": "range", "min": 0, "max": 35, "step": 1, "name": "阈值 "}}], "transform": [{"filter": "datum.v >= cut"}], "mark": {"type": "bar", "color": "#8B5CF6"}, "encoding": {"x": {"field": "m", "type": "ordinal", "title": null}, "y": {"field": "v", "type": "quantitative", "title": "访问量"}}}
```

### 甘特 / 区间条形

**源码**：

````markdown
```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"task": "需求", "start": "2026-01-05", "end": "2026-01-12"}, {"task": "设计", "start": "2026-01-10", "end": "2026-01-20"}, {"task": "开发", "start": "2026-01-18", "end": "2026-02-10"}, {"task": "测试", "start": "2026-02-08", "end": "2026-02-20"}, {"task": "发布", "start": "2026-02-20", "end": "2026-02-24"}]}, "mark": {"type": "bar", "cornerRadius": 4}, "encoding": {"y": {"field": "task", "type": "ordinal", "title": null, "sort": null}, "x": {"field": "start", "type": "temporal", "title": "时间"}, "x2": {"field": "end"}, "color": {"field": "task", "type": "nominal", "legend": null, "scale": {"scheme": "tableau10"}}, "tooltip": [{"field": "task"}, {"field": "start", "type": "temporal"}, {"field": "end", "type": "temporal"}]}}
```
````

**渲染效果**：

```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"task": "需求", "start": "2026-01-05", "end": "2026-01-12"}, {"task": "设计", "start": "2026-01-10", "end": "2026-01-20"}, {"task": "开发", "start": "2026-01-18", "end": "2026-02-10"}, {"task": "测试", "start": "2026-02-08", "end": "2026-02-20"}, {"task": "发布", "start": "2026-02-20", "end": "2026-02-24"}]}, "mark": {"type": "bar", "cornerRadius": 4}, "encoding": {"y": {"field": "task", "type": "ordinal", "title": null, "sort": null}, "x": {"field": "start", "type": "temporal", "title": "时间"}, "x2": {"field": "end"}, "color": {"field": "task", "type": "nominal", "legend": null, "scale": {"scheme": "tableau10"}}, "tooltip": [{"field": "task"}, {"field": "start", "type": "temporal"}, {"field": "end", "type": "temporal"}]}}
```

### 柱状图 + 平均线

**源码**：

````markdown
```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"p": "北京", "v": 26}, {"p": "上海", "v": 34}, {"p": "广州", "v": 21}, {"p": "深圳", "v": 29}, {"p": "杭州", "v": 18}]}, "layer": [{"mark": {"type": "bar", "color": "#c4b5fd", "cornerRadius": 3}, "encoding": {"x": {"field": "p", "type": "nominal", "title": null}, "y": {"field": "v", "type": "quantitative", "title": "延迟 (ms)"}}}, {"mark": {"type": "rule", "color": "#7c3aed", "strokeDash": [5, 4], "strokeWidth": 2}, "encoding": {"y": {"aggregate": "mean", "field": "v", "type": "quantitative"}}}], "encoding": {"tooltip": [{"field": "p"}, {"field": "v"}]}}
```
````

**渲染效果**：

```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"p": "北京", "v": 26}, {"p": "上海", "v": 34}, {"p": "广州", "v": 21}, {"p": "深圳", "v": 29}, {"p": "杭州", "v": 18}]}, "layer": [{"mark": {"type": "bar", "color": "#c4b5fd", "cornerRadius": 3}, "encoding": {"x": {"field": "p", "type": "nominal", "title": null}, "y": {"field": "v", "type": "quantitative", "title": "延迟 (ms)"}}}, {"mark": {"type": "rule", "color": "#7c3aed", "strokeDash": [5, 4], "strokeWidth": 2}, "encoding": {"y": {"aggregate": "mean", "field": "v", "type": "quantitative"}}}], "encoding": {"tooltip": [{"field": "p"}, {"field": "v"}]}}
```

### 气泡图（尺寸 + 颜色编码）

**源码**：

````markdown
```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"proto": "TCP", "pkt": 42, "bytes": 18000, "flows": 120}, {"proto": "UDP", "pkt": 21, "bytes": 6000, "flows": 80}, {"proto": "ICMP", "pkt": 8, "bytes": 900, "flows": 30}, {"proto": "ARP", "pkt": 5, "bytes": 300, "flows": 12}]}, "mark": {"type": "circle", "opacity": 0.7}, "encoding": {"x": {"field": "pkt", "type": "quantitative", "title": "包数"}, "y": {"field": "bytes", "type": "quantitative", "title": "字节数"}, "size": {"field": "flows", "type": "quantitative", "title": "会话数"}, "color": {"field": "proto", "type": "nominal", "scale": {"scheme": "set2"}}, "tooltip": true}}
```
````

**渲染效果**：

```vega-lite
{"$schema": "https://vega.github.io/schema/vega-lite/v5.json", "data": {"values": [{"proto": "TCP", "pkt": 42, "bytes": 18000, "flows": 120}, {"proto": "UDP", "pkt": 21, "bytes": 6000, "flows": 80}, {"proto": "ICMP", "pkt": 8, "bytes": 900, "flows": 30}, {"proto": "ARP", "pkt": 5, "bytes": 300, "flows": 12}]}, "mark": {"type": "circle", "opacity": 0.7}, "encoding": {"x": {"field": "pkt", "type": "quantitative", "title": "包数"}, "y": {"field": "bytes", "type": "quantitative", "title": "字节数"}, "size": {"field": "flows", "type": "quantitative", "title": "会话数"}, "color": {"field": "proto", "type": "nominal", "scale": {"scheme": "set2"}}, "tooltip": true}}
```
