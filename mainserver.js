require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/edu_platform')
  .then(() => console.log('✅ Подключено к MongoDB'))
  .catch(err => console.error('❌ Ошибка подключения к MongoDB:', err));

const db = mongoose.connection;

app.use(helmet());
app.use(cors({ credentials: true, origin: process.env.CLIENT_ORIGIN }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use(session({
  secret: 'secretKey',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/edu_platform' }),
  cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 }
}));

// 📌 Определение моделей
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['teacher', 'student'], required: true },
  points: { type: Number, default: 0 },
  completedTests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Test' }],
  subject: String,
  grades: [{ grade: Number, subject: String }]
});
const User = mongoose.model('User', UserSchema);

const TestSchema = new mongoose.Schema({
  title: String,
  questions: [{
    question: String,
    options: [String],
    correctAnswer: String,
    points: Number
  }],
  createdBy: String
});
const Test = mongoose.model('Test', TestSchema);

const notificationSchema = new mongoose.Schema({
  recipient: { type: String, required: true },  
  sender: { type: String, required: true }, 
  teacher: { type: String },
  student: { type: String },
  points: { type: Number },
  grade: { type: Number },
  subject: { type: String },
  type: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Notification = mongoose.model("Notification", notificationSchema);
module.exports = Notification;

// 📌 Регистрация пользователя
app.post('/register', [
  body('username').trim().isLength({ min: 3 }).withMessage("Имя пользователя должно содержать минимум 3 символа"),
  body('password').isLength({ min: 6 }).withMessage("Пароль должен быть минимум 6 символов"),
  body('role').isIn(['teacher', 'student']).withMessage("Роль должна быть 'teacher' или 'student'")
], async (req, res) => {
  
  console.log("📩 Полученные данные при регистрации:", req.body);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log("❌ Ошибки валидации:", errors.array());
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { username, password, role } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Пользователь с таким именем уже существует" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword, role });

    await user.save();
    res.json({ success: true, message: "Регистрация успешна" });

  } catch (error) {
    console.error("❌ Ошибка на сервере при регистрации:", error);
    res.status(500).json({ success: false, message: "Ошибка сервера" });
  }
});
// 📌 Авторизация
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Неверные данные' });
    }

    req.session.user = { username: user.username, role: user.role, subject: user.subject || null };

    if (user.role === 'teacher') {
      if (!user.subject) {
        console.log("🔸 Перенаправление на выбор предмета");
        return res.json({ success: true, role: 'teacher', redirect: '/select_subject.html' });
      } else {
        console.log("🔸 Перенаправление на панель учителя");
        return res.json({ success: true, role: 'teacher', redirect: '/teacher_dashboard.html' });
      }
    }

    console.log("🔸 Перенаправление на панель студента");
    res.json({ success: true, role: 'student', redirect: '/student_dashboard.html' });

  } catch (error) {
    console.error("Ошибка авторизации:", error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});
  
// 📌 Выход из системы
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true, message: 'Вы вышли' }));
});

// 📌 Обмен баллов на оценку (ученик) 
app.post('/exchange-points', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.status(403).json({ message: 'Доступ запрещён' });
  }

  const { points, grade, subject } = req.body;
  const student = req.session.user.username;

  try {
    const studentUser = await User.findOne({ username: student });
    if (!studentUser || studentUser.points < points) {
      return res.status(400).json({ message: 'Недостаточно баллов' });
    }

    const teacherUser = await User.findOne({ subject, role: 'teacher' });
    if (!teacherUser) {
      return res.status(404).json({ message: 'Учитель не найден' });
    }

    await User.updateOne({ username: student }, { $inc: { points: -points } });

    console.log("👤 Учитель:", teacherUser.username);

    const notification = new Notification({
      recipient: teacherUser.username,
      sender: student, 
      teacher: teacherUser.username,
      student: student,
      points: points,
      grade: grade,
      subject: subject,
      type: 'points_exchange'
    });

    console.log("📌 Создаю уведомление:", notification);
    await notification.save();
    
    res.json({ message: 'Запрос на оценку отправлен учителю' });
  } catch (error) {
    console.error('Ошибка обмена баллов:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});
// 📌 Получение уведомлений
app.get("/get-notifications", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Неавторизованный запрос" });
  }

  const username = req.session.user.username;

  try {
    const notifications = await Notification.find({ recipient: username }).sort({ timestamp: -1 });

    if (notifications.length === 0) {
      return res.json({ success: true, message: "Нет новых уведомлений", notifications: [] });
    }

    console.log("📨 Найденные уведомления:", notifications);
    res.json({ success: true, notifications });
  } catch (error) {
    console.error("❌ Ошибка получения уведомлений:", error);
    res.status(500).json({ success: false, message: "Ошибка сервера" });
  }
});

// 📌 Подтверждение уведомления (учитель)
app.post('/resolve-notification', async (req, res) => {
  const { notificationId } = req.body;

  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: 'Уведомление не найдено' });
    }

    const studentNotification = new Notification({
      recipient: notification.student, // ✅ Получатель - ученик
      sender: notification.teacher,    // ✅ Отправитель - учитель
      teacher: notification.teacher,
      student: notification.student,
      grade: notification.grade,
      subject: notification.subject,
      type: 'grade_assigned'
    });

    await studentNotification.save();
    await Notification.deleteOne({ _id: notificationId });

    res.json({ message: 'Оценка подтверждена' });
  } catch (error) {
    console.error('Ошибка подтверждения уведомления:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получение списка тестов
app.get('/tests', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('Unauthorized');
  }

  const tests = await Test.find();
  res.json(tests);
});

// Получение теста по ID
app.get('/test/:id', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Не авторизован' });
  }
  const test = await Test.findById(req.params.id);
  if (!test) {
    return res.status(404).json({ success: false, message: 'Тест не найден' });
  }
  res.json(test);
});

// Отправка ответов на тест
app.post('/take-test/:testId', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'student') {
      return res.status(403).json({ success: false, message: "Доступ запрещен" });
  }

  const { answers } = req.body;
  const testId = req.params.testId;

  try {
      const test = await Test.findById(testId);
      if (!test) return res.status(404).json({ success: false, message: "Тест не найден" });

      let score = 0;
      test.questions.forEach((q, i) => {
          if (q.correctAnswer === answers[i]) {
              score += q.points;
          }
      });

      await User.updateOne({ username: req.session.user.username }, { $inc: { points: score } });

      res.json({ success: true, message: `Вы набрали ${score} баллов!` });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Ошибка сервера" });
  }
}); 
// Создание теста
app.post("/create-test", async (req, res) => {
    if (!req.session.user || req.session.user.role !== "teacher") {
        return res.status(403).json({ success: false, message: "Доступ запрещён" });
    }

    const { title, questions } = req.body;
    const createdBy = req.session.user.username; 

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ success: false, message: "Некорректные данные" });
    }

    try {
        const newTest = new Test({ title, questions, createdBy }); 
        await newTest.save();
        res.json({ success: true, message: "Тест успешно создан" });
    } catch (error) {
        console.error("Ошибка создания теста:", error);
        res.status(500).json({ success: false, message: "Ошибка сервера" });
    }
});
// Выбор предмета учителем
app.post('/save-subject', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'teacher') {
    return res.status(403).json({ success: false, message: 'Доступ запрещён' });
  }

  try {
    const { subject } = req.body;
    if (!subject) {
      return res.status(400).json({ success: false, message: 'Предмет не указан' });
    }

    await User.updateOne({ username: req.session.user.username }, { subject });

    req.session.user.subject = subject;

    res.json({ success: true, message: 'Предмет сохранён', redirect: '/teacher_dashboard.html' });
  } catch (error) {
    console.error("Ошибка сохранения предмета:", error);
    res.status(500).json({ success: false, message: "Ошибка сервера" });
  }
});
// Получение баллов пользователя
app.get('/user-points', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Не авторизован' });
  }
  const user = await User.findOne({ username: req.session.user.username });
  res.json({ points: user.points });
});
// Получение информации о пользователе
app.get('/user-info', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Не авторизован" });
    }
    res.json({ success: true, role: req.session.user.role, subject: req.session.user.subject });
});
// Роутинг для HTML-страниц
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));
app.get('/teacher_dashboard.html', (req, res) => res.sendFile(__dirname + '/public/teacher_dashboard.html'));
app.get('/student_dashboard.html', (req, res) => res.sendFile(__dirname + '/public/student_dashboard.html'));
app.get('/select_subject.html', (req, res) => res.sendFile(__dirname + '/public/select_subject.html'));

// Запуск сервера
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
