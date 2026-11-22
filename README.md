# 呼吸的地球 · 温室气体交互数据作品

一个基于 NOAA GML 全球月均温室气体观测与 OWID 全球排放数据的交互式数据可视化站点。纯静态，无需后端，可直接部署到任意静态托管平台。

## 目录结构

```
site/
├── index.html              主页面
├── styles.css              样式
├── app.js                  交互逻辑（图表 / 事件轴 / 弹层）
├── data.js                 打包好的数据（浏览器直接加载，无需 fetch）
├── data/
│   ├── climate.json        数据本体（可复核）
│   └── _owid_world_emissions.csv   OWID 排放缓存
├── assets/
│   ├── img/                真实图片（莫纳罗亚站、Keeling、论文首页）
│   └── pdf/                Keeling 1976 论文 PDF
├── vendor/
│   └── chart.umd.js        Chart.js 4.4.1（已本地化，无需外网 CDN）
└── build_data.py           数据生成脚本（可选，用于更新数据）
```

## 如何部署

站点全部使用相对路径，把 `site` 目录里的**全部内容**上传到静态托管即可，入口是 `index.html`。

常见方式：

- **GitHub Pages / Gitee Pages**：把 `site` 目录内容推到仓库根目录（或 `docs/` 目录），在设置里启用 Pages。
- **腾讯云 EdgeOne Pages / CloudBase 静态托管 / Vercel / Netlify**：新建项目时根目录选 `site`，构建命令留空，输出目录填 `.`（即当前目录）。
- **自己的服务器 / Nginx**：把 `site` 目录整体放到 Web 根目录，访问 `index.html`。
- **本地预览**：在 `site` 目录下执行 `python -m http.server 8000`，浏览器打开 `http://localhost:8000`。

> 说明：字体用了 Google Fonts 的在线字体，断网时会自动回退到系统字体，不影响功能与图表。数据、图表库、图片全部在本地，核心内容不依赖外网。

## 页面包含的内容

1. **气体概览**：CO₂、CH₄、N₂O、SF₆ 四张卡片 + 真实观测站照片，点击卡片跳转到对应气体的时间轴。
2. **主时间轴**：四种气体月均浓度切换；长期趋势开关；横轴 A/B/C 三级事件轴（点击看详情）；1976 年 Keeling 论文气泡（点击查看原文摘录与 PDF）。
3. **排放 / 浓度双轨图**：全球 CO₂ 排放与大气浓度增量对比，可切换“化石排放 / 含土地利用”两种口径。
4. **季节振幅趋势**：CO₂ 每年季节振幅变化。
5. **大气滞留比例**：排放中有多少留在大气，含两种口径对比。
6. **碳汇实验室（互动）**：拖动温度、降水、CO₂ 三个滑块，看陆地生态系统是净碳汇还是净碳源。演示 CO₂ 施肥（促进光合）与 Q10 效应（加速呼吸）的拔河，附四种快速情景与温度响应曲线。页面明确标注为教学示意模型，非真实预测。支持 URL 参数设定初始情景，如 `index.html?lt=4&lp=-35&lc=600`。
7. **数据来源与方法**：完整的数据出处与计算口径说明。

## 数据来源

- NOAA Global Monitoring Laboratory，全球月均温室气体序列（gml.noaa.gov/ccgg/trends/）
- Our World in Data / Global Carbon Budget，全球 CO₂ 排放数据
- Keeling, C. D. et al. (1976), Tellus

## 更新数据（可选）

如果需要刷新到最新数据，编辑 `build_data.py` 顶部路径后运行：

```bash
python build_data.py
```

它会重新读取四份 NOAA CSV 和 OWID 排放数据，覆盖 `data/climate.json` 和 `data.js`。注意：站点的 HTML/JS 无需改动。
