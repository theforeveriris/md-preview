const { execFileSync } = require('child_process');
const fs = require('fs');

const msg = `feat(ci): 新增 CodeRabbit AI 代码审查配置

公开仓库用 CodeRabbit 免费（无需付费订阅，含 Team 档功能）。
配置 .coderabbit.yaml，让审查贴合本项目约定而不是套用通用「现代化」建议。

path_instructions 写明的既定约定：
- 模块系统：全部运行时 JS 用传统 <script defer> + IIFE，通过
  window.MarkdownPreview 通信。明确禁止建议改 ES module / 引入 import /
  调整加载顺序 —— 会破坏 index.html 里 64 个 script 标签的顺序约束
  （由 check-script-order.js 检查）、运行时动态加载，以及
  「同一份 JS 被浏览器和 Node 构建脚本共用」的设计
- 纯静态零构建：没有打包器与运行时依赖，第三方库须 vendor 进 iris/vendor/
- i18n：用户可见文案必须 zh / en 双语齐备
- iris/data/ 多为构建产物，改源文件而非产物
- 设置项需同步 defaultSettings / load() / applyAllSettings() / i18n
- 脚本读 git 路径必须加 -c core.quotePath=false（中文文件名会被八进制转义，
  路径在磁盘上不存在，导致静默漏检 —— 本项目踩过这个坑）
- 多个工作流并发向 main 推送时需 fetch + rebase 重试

path_filters 排除 iris/vendor/、iris/data/、docs/ 与 *.md，
只审自研代码（当前 95 个 JS）。

另附两个校验脚本并接入 smoke-test.yml（属性名写错会被静默忽略，
等于规则没生效，故需机器校验）：
- iris/scripts/validate-coderabbit.py    对照官方 JSON Schema 校验
- iris/scripts/check-coderabbit-paths.py 校验 path_filters 命中预期
`;

const file = process.env.TEMP + '/cjk-msg.txt';
fs.writeFileSync(file, msg, 'utf-8');
execFileSync('git', ['-c', 'user.name=theforeveriris', '-c', 'user.email=theforeveriris@users.noreply.github.com', 'commit', '-F', file], {
  stdio: 'inherit',
});
