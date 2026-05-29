import re

# ── 關鍵字對應類別 ─────────────────────────────────────────────────────────────

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "飲食": [
        "飯", "餐", "吃", "喝", "咖啡", "茶", "飲料", "早餐", "午餐", "晚餐", "宵夜",
        "便當", "麵", "火鍋", "燒烤", "壽司", "牛肉", "雞肉", "豬肉", "蛋",
        "蛋糕", "甜點", "零食", "水果", "超商", "超市", "全家", "711", "麥當勞",
        "星巴克", "肯德基", "摩斯", "foodpanda", "ubereats",
    ],
    "交通": [
        "捷運", "公車", "計程車", "uber", "taxi", "油", "加油", "高鐵",
        "火車", "台鐵", "機票", "停車", "過路費", "摩托", "機車",
    ],
    "娛樂": [
        "電影", "ktv", "遊戲", "演唱會", "展覽", "livehouse",
        "netflix", "spotify", "youtube", "disney", "訂閱", "票",
    ],
    "購物": [
        "買", "購", "衣服", "褲", "鞋", "包", "蝦皮", "pchome",
        "momo", "amazon", "ikea", "3c", "手機", "電腦",
    ],
    "醫療": ["醫院", "診所", "藥", "看診", "健檢", "牙醫", "掛號"],
    "居住": ["房租", "租金", "水電", "瓦斯", "網路", "管理費", "修繕", "押金"],
    "生活用品": [
        "衛生紙", "洗髮", "沐浴", "洗碗", "清潔", "洗衣", "牙膏", "牙刷",
        "面紙", "保養", "乳液", "洗面", "棉花棒", "剃刀", "生理",
        "日用", "生活用品", "大賣場", "costco", "家樂福", "全聯",
    ],
    "薪資": ["薪水", "薪資", "工資", "獎金", "年終", "分紅"],
}

_INCOME_KEYWORDS = [
    "薪水", "薪資", "工資", "獎金", "年終", "分紅",
    "入帳", "收入", "匯款", "退款", "報銷", "還錢",
]

_AMOUNT_RE = re.compile(r"[\d,，]+(?:\.\d{1,2})?")
_STRIP_RE = re.compile(r"[NT$＄,，\s]")


def _extract_amount(text: str) -> float | None:
    clean = re.sub(r"[,，]", "", text)
    m = _AMOUNT_RE.search(clean)
    return float(m.group()) if m else None


def _detect_category(text: str) -> str:
    t = text.lower()
    for cat, kws in _CATEGORY_KEYWORDS.items():
        if any(kw in t for kw in kws):
            return cat
    return "其他"


def _is_income(text: str) -> bool:
    return any(kw in text for kw in _INCOME_KEYWORDS)


def _clean_description(text: str, amount: float) -> str | None:
    # 移除金額數字和常見前綴符號
    desc = re.sub(r"NT\$?|＄|\$", "", text)
    desc = re.sub(rf"\b{int(amount)}\b", "", desc)
    desc = re.sub(r"\s+", " ", desc).strip()
    return desc or None


# ── 公開 API（async 保持與 handlers 相容）────────────────────────────────────

async def parse_message(text: str) -> dict:
    """解析用戶訊息，回傳 intent/amount/category/description dict。"""
    amount = _extract_amount(text)

    if amount is None:
        return {
            "intent": "note",
            "amount": None,
            "category": None,
            "description": text[:80],
        }

    intent = "income" if _is_income(text) else "expense"
    category = _detect_category(text)
    description = _clean_description(text, amount)

    return {
        "intent": intent,
        "amount": amount,
        "category": category,
        "description": description,
    }


async def summarize_note(text: str) -> str:
    """無 AI：截斷成摘要。"""
    return text[:120] + ("…" if len(text) > 120 else "")
