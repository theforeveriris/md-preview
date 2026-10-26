const { execFileSync } = require('child_process');
const fs = require('fs');

const msg = `fix(cjk-lint): 修复工作流提交步骤失败，并区分可自动修复 / 需人工处理

一、提交步骤失败（exit code 2）
actions/checkout@v4 检出的是 detached HEAD，自写的 push 重试循环里
\`git pull --rebase origin <branch>\` 在 detached HEAD 上会失败，
配合 shell 的 errexit 语义让整个步骤以 exit code 2 挂掉。
改用 EndBug/add-and-commit（与其他构建工作流同一套机制），
它内部已处理 detached HEAD 与并发推送的重试。

二、区分可自动修复 / 需人工处理
lint-cjk.js 现在给每条问题打 fixable 标记：
  - 可自动修复：spacing / unit / punct / punct-space / dup-punct / fullwidth-digit
  - 需人工处理：line-start（行首禁则，移动标点会改变语义）、quote（直引号）
退出码只对「本该被自动修掉却还在」的问题返回 1；
需人工处理的只报告、不阻断流水线（否则样例文档里的行首禁则会让 CI 永远红）。
问题列表里用 [manual] 标签区分这两类。

三、其他
- 临时文件清理挪到提交之后（原先在提交步骤里 rm，可能与 add-and-commit 竞争）
- 推进基线 tag 时重试若干次，避免并发运行互相覆盖
- 优先指向 origin/main 而非本地 HEAD（CI 里是 detached HEAD）
`;

const file = process.env.TEMP + '/cjk-msg.txt';
fs.writeFileSync(file, msg, 'utf-8');
execFileSync('git', ['-c', 'user.name=theforeveriris', '-c', 'user.email=theforeveriris@users.noreply.github.com', 'commit', '-F', file], {
  stdio: 'inherit',
});
