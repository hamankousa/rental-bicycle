const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { Parser } = require('json2csv');

// --- Firebaseの初期化 ---
const serviceAccount = require('./keiteki-bike-demo-firebase-adminsdk-fbsvc-15a796718e.json'); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// --- APIエンドポイント定義 ---

// GET /api/master: 自転車マスタを取得
app.get('/api/master', (req, res) => {
  try {
    const bikes = JSON.parse(fs.readFileSync(path.join(__dirname, '../demo/data/bikes.json'), 'utf-8'));
    return res.json({ bikes });
  } catch (error) {
    console.error('マスターデータの読み込み中にエラー:', error);
    return res.status(500).json({ message: 'マスターデータの取得に失敗しました' });
  }
});

// GET /api/rentals/current: 現在の貸出状況を取得
app.get('/api/rentals/current', async (req, res) => {
  try {
    const snapshot = await db.collection('rentals').where('endAt', '==', null).get();
    const currentRentals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json(currentRentals);
  } catch (error) {
    console.error('現在の貸出状況の取得中にエラー:', error);
    return res.status(500).json({ message: 'サーバーエラーが発生しました' });
  }
});

// GET /api/residents/:yearMonth: 指定月のユーザーリスト取得
app.get('/api/residents/:yearMonth', async (req, res) => {
  const { yearMonth } = req.params;
  try {
    const residentsCollectionRef = db.collection('residents').doc(yearMonth).collection('details');
    const snapshot = await residentsCollectionRef.orderBy('createdAt').get();
    const residents = snapshot.docs.map(doc => doc.data());
    return res.status(200).json(residents);
  } catch (error) {
    console.error(`${yearMonth} のユーザーリスト取得中にエラー:`, error);
    return res.status(500).json({ message: 'ユーザーリストの取得に失敗しました' });
  }
});

// POST /api/residents/:yearMonth: 指定月への新規ユーザー登録
app.post('/api/residents/:yearMonth', async (req, res) => {
  const { yearMonth } = req.params;
  const { wing, floor, side, name } = req.body;
  if (!wing || !floor || !side || !name) {
    return res.status(400).json({ message: '必須項目が不足しています' });
  }
  try {
    const residentKey = `${wing}-${floor}-${side}-${name}`;
    const residentDocRef = db.collection('residents').doc(yearMonth).collection('details').doc(residentKey);
    const doc = await residentDocRef.get();
    if (doc.exists) {
      return res.status(409).json({ message: 'このユーザーは今月既に登録されています' });
    }
    const newResident = { residentKey, wing, floor, side, name, createdAt: new Date() };
    await residentDocRef.set(newResident);
    return res.status(201).json({ message: 'ユーザー登録が完了しました', resident: newResident });
  } catch (error) {
    console.error(`${yearMonth} のユーザー登録中にエラー:`, error);
    return res.status(500).json({ message: 'ユーザー登録に失敗しました' });
  }
});

// POST /api/rentals: 貸出・返却処理
app.post('/api/rentals', async (req, res) => {
  const { action, bikeId, residentKey } = req.body;
  try {
    if (action === 'start') {
      if (!residentKey) return res.status(400).json({ message: '貸出には利用者キーが必要です' });
      const rentalData = { bikeId, residentKey, startAt: new Date(), endAt: null };
      const docRef = await db.collection('rentals').add(rentalData);
      return res.status(200).json({ message: '貸出成功', rental: { id: docRef.id, ...rentalData } });

    } else if (action === 'end') {
      const query = db.collection('rentals').where('bikeId', '==', bikeId).where('endAt', '==', null).limit(1);
      const snapshot = await query.get();
      if (snapshot.empty) return res.status(404).json({ message: '貸出記録が見つかりません' });

      const rentalDocRef = snapshot.docs[0].ref;
      const rentalData = snapshot.docs[0].data();
      const endResidentKey = rentalData.residentKey;
      if (!endResidentKey) return res.status(500).json({ message: 'レンタル記録に利用者キーがありません。' });

      const startAt = rentalData.startAt.toDate();
      const endAt = new Date();
      const toJstDateString = (date) => new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

      let loopDate = new Date(startAt);
      while (loopDate < endAt) {
        const usageDateStr = toJstDateString(loopDate);
        const dayStart = new Date(usageDateStr + 'T00:00:00.000Z');
        dayStart.setTime(dayStart.getTime() - 9 * 60 * 60 * 1000);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayStart.getDate() + 1);

        const effectiveStart = Math.max(startAt.getTime(), dayStart.getTime());
        const effectiveEnd = Math.min(endAt.getTime(), dayEnd.getTime());
        const durationMinutes = Math.ceil((effectiveEnd - effectiveStart) / (1000 * 60));

        if (durationMinutes > 0) {
          const yearMonth = usageDateStr.slice(0, 7).replace('-', '');
          const dailyUsageDocRef = db.collection('dailyUsage').doc(endResidentKey).collection('dates').doc(usageDateStr);
          const billingDocRef = db.collection('billings').doc(yearMonth).collection('details').doc(endResidentKey);
          
          await db.runTransaction(async (transaction) => {
            const dailyUsageDoc = await transaction.get(dailyUsageDocRef);
            const billingDoc = await transaction.get(billingDocRef);
            const currentDuration = dailyUsageDoc.exists ? dailyUsageDoc.data().totalDurationMinutes : 0;
            const alreadyCharged = dailyUsageDoc.exists ? dailyUsageDoc.data().overageCharged : false;
            const newTotalDuration = currentDuration + durationMinutes;
            let chargeAmount = 0;
            if (newTotalDuration > 480 && !alreadyCharged) chargeAmount = 200;

            transaction.set(dailyUsageDocRef, { totalDurationMinutes: newTotalDuration, overageCharged: alreadyCharged || (chargeAmount > 0) }, { merge: true });

            if (chargeAmount > 0) {
              const currentBilling = billingDoc.exists ? billingDoc.data() : { baseFirstHalf: 0, baseSecondHalf: 0, overageTotal: 0 };
              const newOverage = (currentBilling.overageTotal || 0) + chargeAmount;
              const newTotal = (currentBilling.baseFirstHalf || 0) + (currentBilling.baseSecondHalf || 0) + newOverage;
              transaction.set(billingDocRef, { overageTotal: newOverage, total: newTotal, residentKey: endResidentKey }, { merge: true });
            }
          });
        }
        loopDate.setDate(loopDate.getDate() + 1);
        loopDate.setHours(0, 0, 0, 0);
      }

      const endDayOfMonth = endAt.getDate();
      const endYearMonth = toJstDateString(endAt).slice(0, 7).replace('-', '');
      const finalBillingDocRef = db.collection('billings').doc(endYearMonth).collection('details').doc(endResidentKey);
      const billingDocSnapshot = await finalBillingDocRef.get();
      const baseField = endDayOfMonth <= 15 ? 'baseFirstHalf' : 'baseSecondHalf';
      const currentData = billingDocSnapshot.data() || {};
      
      if (!currentData[baseField] || currentData[baseField] === 0) {
        const updatePayload = { [baseField]: 250, residentKey: endResidentKey };
        const baseFirst = baseField === 'baseFirstHalf' ? 250 : (currentData.baseFirstHalf || 0);
        const baseSecond = baseField === 'baseSecondHalf' ? 250 : (currentData.baseSecondHalf || 0);
        const overage = currentData.overageTotal || 0;
        updatePayload.total = baseFirst + baseSecond + overage;
        await finalBillingDocRef.set(updatePayload, { merge: true });
      }

      await rentalDocRef.update({ endAt: endAt });
      const updatedData = { ...rentalData, endAt: endAt };
      return res.status(200).json({ message: '返却処理が成功しました', rental: { id: snapshot.docs[0].id, ...updatedData } });
    
    } else {
      return res.status(400).json({ message: `無効なアクションです: ${action}` });
    }
  } catch (error) {
    console.error('API処理中にエラー:', error);
    return res.status(500).json({ message: 'サーバーエラーが発生しました' });
  }
});

// GET /api/billing/csv/:yearMonth: 指定年月の請求CSVをダウンロード
app.get('/api/billing/csv/:yearMonth', async (req, res) => {
    const { yearMonth } = req.params;
    try {
        const snapshot = await db.collection('billings').doc(yearMonth).collection('details').get();
        if (snapshot.empty) return res.status(404).send(`データが見つかりません: ${yearMonth}`);
        
        const billingData = snapshot.docs.map(doc => doc.data());
        const fields = [
            { label: '利用者キー', value: 'residentKey' },
            { label: '基本料（前半）', value: 'baseFirstHalf' },
            { label: '基本料（後半）', value: 'baseSecondHalf' },
            { label: '超過料金合計', value: 'overageTotal' },
            { label: '合計金額', value: 'total' },
        ];
        const json2csvParser = new Parser({ fields, withBOM: true });
        const csv = json2csvParser.parse(billingData);
        res.header('Content-Type', 'text/csv; charset=UTF-8');
        res.attachment(`billing-${yearMonth}.csv`);
        return res.status(200).send(csv);
    } catch (error) {
        console.error('CSV生成中にエラー:', error);
        return res.status(500).send('サーバーエラーが発生しました');
    }
});

// --- サーバー起動 ---
app.listen(port, () => {
  console.log(`サーバーが http://localhost:${port} で起動しました`);
  console.log('Firestoreに接続済みです。');
});