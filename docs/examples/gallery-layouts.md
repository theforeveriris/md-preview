---
title: 画廊布局样式速查
tags: [画廊]
---

# 画廊布局样式速查

本页是画廊布局样式的快速查阅卡片。完整示例与说明见 [图片画廊与懒加载示例](image-gallery-examples.md#3-画廊布局样式)。

## 语法

在连续图片之前，用单独一行 `@样式名` 指定该组图片的渲染样式：

```markdown
@cardstack

![图1](url1)
![图2](url2)
![图3](url3)
```

- `@style` 必须独占一行（单独成段）
- 标记只作用于紧跟其后的一组连续图片
- 不写 `@style` 时，连续 2 张及以上图片自动使用默认网格布局
- 未识别的 `@xxx` 会被当作普通文本输出

## 样式速查表

| 样式 | 说明 | 推荐图片数 |
|------|------|-----------|
| `@grid` | 默认网格，自适应列数（与不写标记相同） | 任意 |
| `@cardstack` | 扑克牌堆：中间主图，左右错层露一角，5°斜边 + 边缘模糊 | 3 张 |
| `@filmstrip` | 胶片条：横向滚动，上下带胶片穿孔装饰 | 任意（≥3 张效果更佳） |
| `@polaroid` | 拍立得墙：白边相框，轻微旋转错落排布 | 任意 |
| `@stack` | 堆叠覆盖：图片相互覆盖，hover 时展开扇形 | 3-5 张 |
| `@mosaic` | 马赛克：首张大图占两格，其余小图网格排布 | 5 张 |
| `@scattered` | 散落明信片：图片随机散落画布，hover 置顶拉直放大 | 6 张以内 |
| `@hexagon` | 蜂巢六边形：图片裁切为六边形，错位蜂巢排列 | 任意 |
| `@coverflow` | Cover Flow：中间正中放大，两侧 3D 倾斜后退，hover 整体滑动 | 5 张 |
| `@tape` | 软木板留言墙：软木纹理 + 多色和纸胶带贴顶角 | 任意 |
| `@duotone` | 双色调：单色化叠加主题色，hover 恢复彩色（克制） | 任意 |
| `@frame` | 画框装裱：精致金属画框，居中纵列展示（克制） | 任意 |
| `@arch` | 拱形画廊：顶部裁切为拱形，罗马建筑感（克制） | 任意 |
| `@masonry` | 瀑布流：CSS columns 错落排布，保持原始宽高比（实用） | 任意（≥4 张效果更佳） |
| `@slider` | 幻灯片：自动轮播，循环切换，hover 暂停（实用） | 任意（≥3 张） |
| `@ticket` | 票根：撕边虚线 + 半圆缺口，票根造型（克制） | 任意 |
| `@panorama` | 全景横幅：超宽横向滚动拼接，沉浸式浏览（实用） | 任意（≥3 张） |

## 效果演示

### `@grid` — 默认网格

@grid

![grid-1](https://picsum.photos/400/300?grid1)
![grid-2](https://picsum.photos/400/300?grid2)
![grid-3](https://picsum.photos/400/300?grid3)
![grid-4](https://picsum.photos/400/300?grid4)

### `@cardstack` — 扑克牌堆

@cardstack

![card-1](https://picsum.photos/400/500?card1)
![card-2](https://picsum.photos/400/500?card2)
![card-3](https://picsum.photos/400/500?card3)

### `@filmstrip` — 胶片条

@filmstrip

![film-1](https://picsum.photos/400/300?film1)
![film-2](https://picsum.photos/400/300?film2)
![film-3](https://picsum.photos/400/300?film3)
![film-4](https://picsum.photos/400/300?film4)
![film-5](https://picsum.photos/400/300?film5)

### `@polaroid` — 拍立得墙

@polaroid

![polaroid-1](https://picsum.photos/300/300?pol1)
![polaroid-2](https://picsum.photos/300/300?pol2)
![polaroid-3](https://picsum.photos/300/300?pol3)
![polaroid-4](https://picsum.photos/300/300?pol4)

### `@stack` — 堆叠覆盖

@stack

![stack-1](https://picsum.photos/400/300?stk1)
![stack-2](https://picsum.photos/400/300?stk2)
![stack-3](https://picsum.photos/400/300?stk3)
![stack-4](https://picsum.photos/400/300?stk4)

### `@mosaic` — 马赛克

@mosaic

![mosaic-main](https://picsum.photos/600/400?mosmain)
![mosaic-2](https://picsum.photos/300/200?mos2)
![mosaic-3](https://picsum.photos/300/200?mos3)
![mosaic-4](https://picsum.photos/300/200?mos4)
![mosaic-5](https://picsum.photos/300/200?mos5)

### `@scattered` — 散落明信片

@scattered

![scatter-1](https://picsum.photos/400/300?sct1)
![scatter-2](https://picsum.photos/400/300?sct2)
![scatter-3](https://picsum.photos/400/300?sct3)
![scatter-4](https://picsum.photos/400/300?sct4)
![scatter-5](https://picsum.photos/400/300?sct5)
![scatter-6](https://picsum.photos/400/300?sct6)

### `@hexagon` — 蜂巢六边形

@hexagon

![hex-1](https://picsum.photos/300/400?hex1)
![hex-2](https://picsum.photos/300/400?hex2)
![hex-3](https://picsum.photos/300/400?hex3)
![hex-4](https://picsum.photos/300/400?hex4)
![hex-5](https://picsum.photos/300/400?hex5)
![hex-6](https://picsum.photos/300/400?hex6)

### `@coverflow` — Cover Flow

@coverflow

![cov-1](https://picsum.photos/400/500?cov1)
![cov-2](https://picsum.photos/400/500?cov2)
![cov-3](https://picsum.photos/400/500?cov3)
![cov-4](https://picsum.photos/400/500?cov4)
![cov-5](https://picsum.photos/400/500?cov5)

### `@tape` — 软木板留言墙

@tape

![tape-1](https://picsum.photos/400/300?tap1)
![tape-2](https://picsum.photos/400/300?tap2)
![tape-3](https://picsum.photos/400/300?tap3)
![tape-4](https://picsum.photos/400/300?tap4)

### `@duotone` — 双色调

@duotone

![duo-1](https://picsum.photos/400/300?duo1)
![duo-2](https://picsum.photos/400/300?duo2)
![duo-3](https://picsum.photos/400/300?duo3)
![duo-4](https://picsum.photos/400/300?duo4)

### `@frame` — 画框装裱

@frame

![frame-1](https://picsum.photos/600/400?frm1)
![frame-2](https://picsum.photos/600/400?frm2)
![frame-3](https://picsum.photos/600/400?frm3)

### `@arch` — 拱形画廊

@arch

![arch-1](https://picsum.photos/500/400?arh1)
![arch-2](https://picsum.photos/500/400?arh2)
![arch-3](https://picsum.photos/500/400?arh3)
![arch-4](https://picsum.photos/500/400?arh4)

### `@masonry` — 瀑布流

@masonry

![mas-1](https://picsum.photos/400/600?mas1)
![mas-2](https://picsum.photos/400/300?mas2)
![mas-3](https://picsum.photos/400/500?mas3)
![mas-4](https://picsum.photos/400/400?mas4)
![mas-5](https://picsum.photos/400/700?mas5)
![mas-6](https://picsum.photos/400/350?mas6)

### `@slider` — 幻灯片

@slider

![slide-1](https://picsum.photos/800/400?sld1)
![slide-2](https://picsum.photos/800/400?sld2)
![slide-3](https://picsum.photos/800/400?sld3)
![slide-4](https://picsum.photos/800/400?sld4)

### `@ticket` — 票根

@ticket

![ticket-1](https://picsum.photos/600/300?tkt1)
![ticket-2](https://picsum.photos/600/300?tkt2)
![ticket-3](https://picsum.photos/600/300?tkt3)

### `@panorama` — 全景横幅

@panorama

![pano-1](https://picsum.photos/800/400?pan1)
![pano-2](https://picsum.photos/800/400?pan2)
![pano-3](https://picsum.photos/800/400?pan3)
![pano-4](https://picsum.photos/800/400?pan4)

## 自定义样式

所有画廊样式定义在 [iris/css/galleries.css](../../iris/css/galleries.css) 中。如需新增样式：

1. 在 `galleries.css` 中添加 `.image-gallery--{新样式名}` 选择器
2. 在 [iris/js/markdown.js](../../iris/js/markdown.js) 的 `knownStyles` 数组里加入新样式名

样式采用 BEM 风格的修饰类命名：基础类 `.image-gallery` + 修饰类 `.image-gallery--{style}`。
