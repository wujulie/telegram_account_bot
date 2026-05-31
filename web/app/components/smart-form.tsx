import { PlusIcon } from "./icons";

export function SmartForm() {
  return (
    <form className="glass-card form-grid">
      <div>
        <p className="section-kicker">Quick Add</p>
        <h2>新增收支</h2>
      </div>
      <label>
        <span>類型</span>
        <select name="type" defaultValue="expense">
          <option value="expense">支出</option>
          <option value="income">收入</option>
        </select>
      </label>
      <label>
        <span>金額</span>
        <input name="amount" inputMode="numeric" placeholder="1280" />
      </label>
      <label>
        <span>分類</span>
        <input name="category" placeholder="餐飲 / 交通 / 生活" />
      </label>
      <label className="wide">
        <span>描述</span>
        <input name="description" placeholder="午餐、捷運、咖啡..." />
      </label>
      <button className="primary-button wide" type="submit">
        <PlusIcon className="size-4" />
        新增
      </button>
    </form>
  );
}
