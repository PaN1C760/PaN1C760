document.addEventListener("DOMContentLoaded", async () => {
    const testForm = document.getElementById("testForm");
    const questionsContainer = document.getElementById("questionsContainer");
    const addQuestionBtn = document.getElementById("addQuestion");
    const testsList = document.getElementById("tests");
    const logoutBtn = document.getElementById("logoutBtn");
    const notificationsBtn = document.getElementById("notifications-btn");

    let teacherUsername = "";

    // ✅ Получение информации о пользователе
    async function getUserInfo() {
        try {
            const response = await fetch("/user-info", { credentials: "include" });
            if (response.ok) {
                const userData = await response.json();
                if (userData.role !== "teacher") {
                    window.location.href = "/login.html"; // Перенаправляем, если это не учитель
                } else {
                    teacherUsername = userData.username; // Сохраняем имя пользователя
                }
            } else {
                window.location.href = "/login.html";
            }
        } catch (error) {
            console.error("Ошибка загрузки данных пользователя:", error);
            window.location.href = "/login.html";
        }
    }

    await getUserInfo(); // Загружаем данные перед выполнением остальных действий

    // ✅ Добавление вопроса
    addQuestionBtn.addEventListener("click", () => {
        const questionDiv = document.createElement("div");
        questionDiv.classList.add("question-item"); // Для удобства стилей
        questionDiv.innerHTML = `
            <input type="text" placeholder="Вопрос" class="question" required>
            <input type="text" placeholder="Варианты ответа (через запятую)" class="options" required>
            <input type="text" placeholder="Правильный ответ" class="correctAnswer" required>
            <input type="number" placeholder="Баллы" class="points" required>
            <button class="remove-question">Удалить</button>
        `;
        questionsContainer.appendChild(questionDiv);

        // ✅ Удаление вопроса
        questionDiv.querySelector(".remove-question").addEventListener("click", () => {
            questionDiv.remove();
        });
    });

    // ✅ Отправка теста в базу
    testForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const title = document.getElementById("testTitle").value;
        const questions = [...questionsContainer.querySelectorAll(".question-item")].map(q => ({
            question: q.querySelector(".question").value.trim(),
            options: q.querySelector(".options").value.split(",").map(opt => opt.trim()),
            correctAnswer: q.querySelector(".correctAnswer").value.trim(),
            points: Number(q.querySelector(".points").value),
        }));

        if (!title || questions.length === 0) {
            alert("Введите название теста и добавьте хотя бы один вопрос.");
            return;
        }

        const response = await fetch("/create-test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, questions, createdBy: teacherUsername }), // ✅ Добавили автора теста
            credentials: "include",
        });

        if (response.ok) {
            alert("Тест создан!");
            testForm.reset();
            questionsContainer.innerHTML = "";
            loadTests();
        } else {
            const errorText = await response.text();
            alert("Ошибка при создании теста: " + errorText);
        }
    });

    // ✅ Загрузка списка тестов
    async function loadTests() {
        try {
            const response = await fetch("/tests");
            if (!response.ok) throw new Error("Ошибка загрузки тестов");

            const tests = await response.json();
            testsList.innerHTML = tests
                .map(test => `<li>${test.title} (Автор: ${test.createdBy})</li>`)
                .join("");
        } catch (error) {
            console.error("Ошибка загрузки тестов:", error);
            testsList.innerHTML = "<li>Ошибка загрузки тестов</li>";
        }
    }

    // ✅ Выход из системы
    logoutBtn.addEventListener("click", async () => {
        await fetch("/logout", { method: "POST", credentials: "include" });
        window.location.href = "/login.html";
    });

    // ✅ Переход на страницу уведомлений
    notificationsBtn.addEventListener("click", () => {
        window.location.href = "/notifications.html";
    });

    await loadTests();
});
