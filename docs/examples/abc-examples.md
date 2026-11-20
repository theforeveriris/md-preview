---
title: ABC 乐谱
tags: [音乐, 图表, 五线谱]
---

# ABC 乐谱

` ```abc ` 围栏写 ABC 记谱法，站内用 [abcjs](https://abcjs.net/) 渲染五线谱。
abcjs 已放在 `iris/vendor/abcjs/`，不请求外部服务；` ```music ` 是等价别名。

ABC 的基本结构：

```
X:1          % 编号
T:Title      % 标题
C:Composer   % 作曲
M:4/4        % 拍号
L:1/4        % 默认音符时值
K:C          % 调号
C D E F | G A B c |
```

- 音名：`C D E F G A B`，小写 `c` 是高八度，`c'` 更高，`C,` 更低。
- 时值：`C2` 两倍、`C/2` 一半、`C3/2` 附点。
- 休止：`z`；连音线 `-`；圆滑线 `(C D)`。
- 和弦：`[CEG]`；和弦标记：`"Cmaj7"`。
- 歌词：`w: syl-la-ble`。
- 多声部：`V:1` / `V:2`。

可选 JSON 头用于指弹谱、移调等，用 `---` 与正文分隔：

```
{ "tablature": [{ "instrument": "guitar" }], "visualTranspose": 2 }
---
X:1
...
```

---

## 一、基础音阶

**源码**：

````markdown
```abc
X:1
T:C Major Scale
C:Traditional
M:4/4
L:1/4
K:C
C D E F | G A B c |]
```
````

**渲染效果**：

```abc
X:1
T:C Major Scale
C:Traditional
M:4/4
L:1/4
K:C
C D E F | G A B c |]
```

---

## 二、时值、休止与连线

**源码**：

````markdown
```abc
X:1
T:Rhythm
M:4/4
L:1/8
K:C
C2 D E2 F | G4 z4 | c2-c2 B2 A2 |]
```
````

**渲染效果**：

```abc
X:1
T:Rhythm
M:4/4
L:1/8
K:C
C2 D E2 F | G4 z4 | c2-c2 B2 A2 |]
```

---

## 三、调号与临时记号

`^` 升号、`_` 降号、`=` 还原；`K:G` 等调号会自动处理。

**源码**：

````markdown
```abc
X:1
T:Accidentals
M:4/4
L:1/4
K:G
G A B c | d e ^f g | =f _e d c |]
```
````

**渲染效果**：

```abc
X:1
T:Accidentals
M:4/4
L:1/4
K:G
G A B c | d e ^f g | =f _e d c |]
```

---

## 四、和弦与和弦标记

`[CEG]` 是同时发声的和弦，`"Am"` 是和弦符号。

**源码**：

````markdown
```abc
X:1
T:Chords
M:4/4
L:1/4
K:C
"Am" [CEA]2 "F" [CFA]2 | "C" [CEG]2 "G" [GBd]2 |]
```
````

**渲染效果**：

```abc
X:1
T:Chords
M:4/4
L:1/4
K:C
"Am" [CEA]2 "F" [CFA]2 | "C" [CEG]2 "G" [GBd]2 |]
```

---

## 五、歌词

`w:` 行按音节对齐；`-` 连接同一词的多个音节，`_` 延长，`*` 跳过。

**源码**：

````markdown
```abc
X:1
T:Ode to Joy
C:Beethoven
M:4/4
L:1/4
K:C
C D E F | G G F2 | E E D D | C2 z2 |
w: Joy-ful, joy-ful we a-dore thee,
```
````

**渲染效果**：

```abc
X:1
T:Ode to Joy
C:Beethoven
M:4/4
L:1/4
K:C
C D E F | G G F2 | E E D D | C2 z2 |
w: Joy-ful, joy-ful we a-dore thee,
```

---

## 六、多声部

`V:` 声明声部；`%%score` 控制谱表分组（可选）。

**源码**：

````markdown
```abc
X:1
T:Duet
M:4/4
L:1/4
K:C
%%score (1 2)
V:1
c2 B2 | A2 G2 |]
V:2
E2 D2 | C2 B,2 |]
```
````

**渲染效果**：

```abc
X:1
T:Duet
M:4/4
L:1/4
K:C
%%score (1 2)
V:1
c2 B2 | A2 G2 |]
V:2
E2 D2 | C2 B,2 |]
```

---

## 七、反复与跳房子

**源码**：

````markdown
```abc
X:1
T:Repeat
M:4/4
L:1/4
K:C
|: C D E F |1 G2 G2 :|2 A2 A2 |]
```
````

**渲染效果**：

```abc
X:1
T:Repeat
M:4/4
L:1/4
K:C
|: C D E F |1 G2 G2 :|2 A2 A2 |]
```

---

## 八、装饰音与力度记号

**源码**：

````markdown
```abc
X:1
T:Ornaments
M:4/4
L:1/4
K:C
!trill!C2 !fermata!D2 | .E2 !accent!F2 | !tenuto!G4 |]
```
````

**渲染效果**：

```abc
X:1
T:Ornaments
M:4/4
L:1/4
K:C
!trill!C2 !fermata!D2 | .E2 !accent!F2 | !tenuto!G4 |]
```

---

## 九、吉他指弹谱

JSON 头里传 `tablature` 选项，abcjs 会在五线谱下方加六线谱。

**源码**：

````markdown
```abc
{ "tablature": [{ "instrument": "guitar" }] }
---
X:1
T:Guitar Tab
M:4/4
L:1/4
K:C
C D E F | G A B c |]
```
````

**渲染效果**：

```abc
{ "tablature": [{ "instrument": "guitar" }] }
---
X:1
T:Guitar Tab
M:4/4
L:1/4
K:C
C D E F | G A B c |]
```

---

## 十、移调显示

`visualTranspose` 只改变显示音高，不改变 ABC 源。

**源码**：

````markdown
```abc
{ "visualTranspose": 2 }
---
X:1
T:Transposed +2
M:4/4
L:1/4
K:C
C D E F | G A B c |]
```
````

**渲染效果**：

```abc
{ "visualTranspose": 2 }
---
X:1
T:Transposed +2
M:4/4
L:1/4
K:C
C D E F | G A B c |]
```

---

## 十一、一个围栏里放多首曲子

每个 `X:` 开始一首新曲，abcjs 会依次排版。

**源码**：

````markdown
```abc
X:1
T:First Tune
M:4/4
L:1/4
K:C
C D E F | G2 G2 |]
X:2
T:Second Tune
M:3/4
L:1/4
K:G
G A B | d2 B |]
```
````

**渲染效果**：

```abc
X:1
T:First Tune
M:4/4
L:1/4
K:C
C D E F | G2 G2 |]
X:2
T:Second Tune
M:3/4
L:1/4
K:G
G A B | d2 B |]
```

---

## 十二、`music` 别名

` ```music ` 与 ` ```abc ` 完全等价：

````markdown
```music
X:1
T:Alias
M:4/4
L:1/4
K:C
E G B e | d2 B2 |]
```
````

**渲染效果**：

```music
X:1
T:Alias
M:4/4
L:1/4
K:C
E G B e | d2 B2 |]
```

---

## 十三、完整歌曲

旋律、和弦、歌词与反复一起使用：

**源码**：

````markdown
```abc
X:1
T:Simple Song
C:Traditional
M:4/4
L:1/4
K:C
"Am" A2 "F" F2 | "C" E2 "G" G2 |
w: Hel-lo world, sing a song,
"C" C D E F | "G" G2 G2 |]
w: ev-ery-one come a-long.
```
````

**渲染效果**：

```abc
X:1
T:Simple Song
C:Traditional
M:4/4
L:1/4
K:C
"Am" A2 "F" F2 | "C" E2 "G" G2 |
w: Hel-lo world, sing a song,
"C" C D E F | "G" G2 G2 |]
w: ev-ery-one come a-long.
```

---

## 十四、限制与说明

- 使用本地 `iris/vendor/abcjs/abcjs-basic-min.js`（MIT），只含乐谱渲染，不含音频合成。
- 乐谱颜色在渲染时读取当前主题文字色；切换主题后如需完全匹配，可刷新页面。
- ABC 语法错误时 abcjs 可能仍输出部分谱面，并在卡片底部给出提示；严重错误会回退源码。
- 指弹谱 / 移调等选项通过 JSON 头传入，只接受白名单字段（`tablature`、`visualTranspose`、`scale` 等）。
- 导出 SVG 会合并同一围栏里的多首曲子。
