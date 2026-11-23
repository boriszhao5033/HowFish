# HowFish 🐟

一款面向日常买鱼、料理与鱼类分类查询的离线可用 Web 应用（PWA），聚焦中国与澳洲常见海鱼及淡水鱼的命名对照、形态/分类信息与烹饪参考。

🔗 **在线访问**：[https://howfish.pages.dev](https://howfish.pages.dev)  
📱 **离线使用**：手机浏览器（iOS Safari / Android Chrome）打开上方链接，选择「添加到主屏幕」，即可在菜市场或断网环境下秒开查询。

<img width="1254" height="999" alt="image" src="https://github.com/user-attachments/assets/bcd80569-3ed8-4148-a383-490f320e6785" />


## ✨ 核心特色

- **350+ 鱼类条目**：整理常见海鱼与淡水鱼的分类体系、学名及中澳多地俗名对照。
- **实用食用维度**：涵盖肉质风味、肌间刺特征、组胺/食安注意事项及推荐烹饪方式。
- **高效检索与对比**：支持多条件筛选、图鉴/表格视图切换及多物种参数并排对比。
- **纯静态离线优先**：前端数据随应用打包，无需登录、零广告、支持离线浏览。

## 📦 公开数据结构

本项目已剥离内部采集与溯源信息，仅公开整理后的纯净前端数据，可直接下载参考：

- `public/data/species.json`：鱼类核心属性与食用信息库
- `public/data/taxonomy.json`：分类学层级索引数据

## 🛠️ 本地运行

环境要求：Node.js `20+`（推荐 `22`）

```bash
# 1. 克隆仓库
git clone [https://github.com/boriszhao5033/HowFish.git](https://github.com/boriszhao5033/HowFish.git)
cd HowFish

# 2. 安装依赖
npm install

# 3. 本地开发预览
npm run dev

# 4. 生产环境构建
npm run build
