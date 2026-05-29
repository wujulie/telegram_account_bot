import io
from collections import defaultdict

import matplotlib
matplotlib.use("Agg")  # 無顯示器環境
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

# 嘗試使用系統中文字型；若無則 matplotlib 預設
_CJK_FONTS = [
    "PingFang TC", "Heiti TC", "Microsoft JhengHei",
    "Noto Sans CJK TC", "WenQuanYi Micro Hei",
]

def _cjk_font():
    available = {f.name for f in fm.fontManager.ttflist}
    for name in _CJK_FONTS:
        if name in available:
            return name
    return None


COLORS = [
    "#FF6B6B", "#FFA94D", "#FFD43B", "#69DB7C",
    "#4DABF7", "#748FFC", "#DA77F2", "#F783AC",
    "#A9E34B", "#63E6BE",
]


def generate_pie_chart(expenses: list[dict], year: int, month: int) -> io.BytesIO:
    """
    expenses: list of transaction dicts with 'category' and 'amount'.
    Returns PNG bytes in a BytesIO buffer.
    """
    totals: dict[str, float] = defaultdict(float)
    for tx in expenses:
        totals[tx["category"]] += float(tx["amount"])

    if not totals:
        # 回傳一張「無資料」圖
        fig, ax = plt.subplots(figsize=(5, 4))
        ax.text(0.5, 0.5, f"{year}年{month:02d}月\n尚無支出記錄",
                ha="center", va="center", fontsize=14,
                fontfamily=_cjk_font() or "sans-serif")
        ax.axis("off")
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=120, bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        return buf

    labels = list(totals.keys())
    values = [totals[k] for k in labels]
    total = sum(values)
    colors = COLORS[: len(labels)]

    font_kw = {"fontfamily": _cjk_font()} if _cjk_font() else {}

    fig, ax = plt.subplots(figsize=(7, 5))
    wedges, texts, autotexts = ax.pie(
        values,
        labels=None,
        autopct="%1.1f%%",
        startangle=140,
        colors=colors,
        wedgeprops={"linewidth": 1, "edgecolor": "white"},
        pctdistance=0.78,
    )
    for at in autotexts:
        at.set_fontsize(10)

    # 圖例：類別 + 金額
    legend_labels = [f"{lbl}  ${v:,.0f}" for lbl, v in zip(labels, values)]
    ax.legend(
        wedges,
        legend_labels,
        title="類別",
        loc="center left",
        bbox_to_anchor=(1, 0, 0.5, 1),
        fontsize=10,
        **font_kw,
    )

    ax.set_title(
        f"{year}年{month:02d}月 支出分布\n總計 ${total:,.0f}",
        fontsize=13,
        pad=12,
        **font_kw,
    )

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf
