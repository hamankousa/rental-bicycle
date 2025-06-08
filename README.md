# レンチャリデモ 🚲

**寮の自転車（レンチャリ）管理をオンライン化するプロジェクト**

寮生がタブレットから自転車の貸出・返却を行い、管理者は月末に請求データをCSVで一括ダウンロードできるシステムです。

**[🔗 デモページはこちら](https://your-username.github.io/keiteki-rental-bicycle/demo/)**
*(※GitHub Pagesのデプロイ後にURLを更新してください)*

---

## ✨ このプロジェクトのゴール

> **寮生が 1 台のタブレットから “借りる / 返す” 操作をすると、
> データは即サーバーに記録され、月末に自動生成される CSV を
> 管理者がダウンロードして請求書を作れる――これをすべてオンラインで実現する。**

より詳細な要件や設計については、以下のドキュメントを参照してください。
- **[📄 要件定義・開発フロー詳細ガイド](./レンチャリ要件定義,開発フロー.md)**

---

## 🚀 開発を始める（Get Started）

このプロジェクトは **GitHub Codespaces** を使って、ブラウザ上ですぐに開発を始めることができます。ローカルPCにNode.jsなどをインストールする必要はありません。

1.  **Codespaceを起動する**
    -   このリポジトリの上部にある **`< > Code`** ボタンをクリック
    -   **`Codespaces`** タブを選択
    -   **`Create codespace on main`** をクリック
    -   数分待つと、ブラウザ上にVS Codeが起動します。

2.  **サーバーを起動する**
    -   VS Codeのターミナルで以下のコマンドを実行します。

    ```bash
    cd server
    npm install
    node server.js
    ```

    -   サーバーがポート `3000` で起動します。
    -   右下に表示されるポップアップで **`Make Public`** をクリックするか、**`PORTS`** タブで `3000` 番ポートの `Visibility` を `Public` に変更してください。

3.  **フロントエンドを確認する**
    -   このリポジトリはGitHub Pagesに自動でデプロイされています。
    -   **[デモページ](https://your-username.github.io/keiteki-rental-bicycle/demo/)** にアクセスして、実際の画面を確認できます。
    -   サーバーを起動したCodespaceのURLと連携して動作します。

---

## 🛠️ 技術スタック

| 領域             | 技術                                                                                    | 目的                                     |
| ---------------- | --------------------------------------------------------------------------------------- | ---------------------------------------- |
| **フロントエンド**   | `HTML` / `CSS` / `JavaScript (vanilla)`                                                 | 利用者向けUIの構築                       |
| **バックエンド**     | `Node.js` + `Express`                                                                   | REST APIサーバーの構築                   |
| **データベース**     | `Firestore (NoSQL)`                                                                     | レンタル履歴、請求情報の永続化           |
| **サーバーレス**     | `Cloud Functions`                                                                       | 課金計算、月末CSVバッチ処理              |
| **インフラ**       | `GitHub Pages`, `GitHub Actions`                                                        | フロントエンドのホスティングと自動デプロイ |
| **開発環境**       | `GitHub Codespaces`                                                                     | 統一されたクラウドベースの開発環境       |

---

## 📂 プロジェクト構成

```
keiteki-rental-bicycle/
├ demo/            # フロントエンド (HTML/CSS/JS)
│ ├ index.html
│ ├ style.css
│ └ main.js
├ server/          # バックエンド (Node.js + Express)
│ └ server.js
├ .github/
│ └ workflows/   # GitHub Actions (自動デプロイ)
├ レンチャリ要件定義,開発フロー.md  # このプロジェクトの設計書
└ README.md        # いま見ているファイル
```

---

## 📝 貢献方法 (How to Contribute)

このプロジェクトへの貢献を歓迎します！

1.  **Issueを確認する**: やるべきタスクは **[Issues](https://github.com/your-username/keiteki-rental-bicycle/issues)** にまとめられています。
2.  **ブランチを作成する**: `feat/add-new-feature` や `fix/resolve-bug` のような名前で新しいブランチを作成します。
3.  **開発する**: コードを書き、変更を加えます。
4.  **コミットする**: `feat: 新機能を追加` のように、変更内容が分かるコミットメッセージをつけます。
5.  **Pull Requestを作成する**: `main`ブランチに対してPull Requestを作成し、レビューを依頼してください。

---