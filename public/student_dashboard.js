document.addEventListener("DOMContentLoaded", async () => {
    const testsList = document.getElementById("tests");
    const testContainer = document.getElementById("test-container");
    const testTitle = document.getElementById("test-title");
    const questionsContainer = document.getElementById("questionsContainer");
    const testForm = document.getElementById("testForm");
    const pointsExchangeDisplay = document.getElementById("points-display");
    const logoutBtn = document.getElementById("logoutBtn");
    const exchangeBtn = document.getElementById("exchangeBtn");
    const notificationsBtn = document.getElementById('notifications-btn');
    let currentTestId = null;

    // Загрузка списка тестов
    async function loadTests() {
        try {
            const response = await fetch('/tests');
            if (!response.ok) throw new Error('Ошибка загрузки тестов');
            const tests = await response.json();
            
            testsList.innerHTML = ''; 
            tests.forEach(test => {
                const testButton = document.createElement('button');
                testButton.classList.add('test-button');
                testButton.textContent = test.title;
                testButton.addEventListener('click', () => startTest(test._id));
                testsList.appendChild(testButton);
            });
        } catch (error) {
            console.error('Ошибка:', error);
        }
    }

    // Запуск теста
    async function startTest(testId) {
        try {
            const response = await fetch(`/test/${testId}`, { credentials: 'include' });
            if (!response.ok) throw new Error("Ошибка загрузки теста");
            const test = await response.json();
            currentTestId = testId;
            displayTest(test);
        } catch (error) {
            console.error("Ошибка загрузки теста:", error);
        }
    }

    // Отображение теста
    function displayTest(test) {
        testContainer.style.display = "block";
        testTitle.textContent = test.title;
        questionsContainer.innerHTML = "";
    
        test.questions.forEach((q, index) => {
            const div = document.createElement("div");
            div.classList.add("question-block");
    
            const questionTitle = document.createElement("p");
            questionTitle.textContent = `${index + 1}. ${q.question}`;
            div.appendChild(questionTitle);
    
            q.options.forEach(option => {
                const label = document.createElement("label");
                label.classList.add("answer-option");
                label.innerHTML = `
                    <input type="radio" name="question${index}" value="${option}" required>
                    <span>${option}</span>
                `;
                div.appendChild(label);
            });
    
            questionsContainer.appendChild(div);
        });
    }
    // Отправка ответов
    testForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const answers = [...questionsContainer.querySelectorAll("input:checked")].map(input => input.value);

        if (answers.length === 0) {
            alert("Выберите хотя бы один ответ!");
            return;
        }

        try {
            const response = await fetch(`/take-test/${currentTestId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers }),
                credentials: 'include'
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            alert(result.message);
            testContainer.style.display = "none";
            loadTests();
            loadPoints();
        } catch (error) {
            console.error(error);
            alert("Ошибка при отправке ответов");
        }
    });

    // Загрузка баллов
    async function loadPoints() {
        try {
            const response = await fetch('/user-points', { credentials: 'include' });
            if (!response.ok) throw new Error('Ошибка загрузки баллов');
            const data = await response.json();
            pointsExchangeDisplay.innerText = data.points;
        } catch (error) {
            console.error('Ошибка загрузки баллов:', error);
        }
    }

    // Выход из системы
    logoutBtn.addEventListener("click", () => {
        fetch("/logout", { method: "POST", credentials: "include" })
            .then(() => window.location.href = "/login.html")
            .catch(error => console.error("Ошибка выхода:", error));
    });

    // Обмен баллов на оценку
    exchangeBtn.addEventListener('click', async () => {
        const selectedGrade = Number(document.getElementById('grade').value);
        const selectedSubject = document.getElementById('subject').value;
        const cost = selectedGrade * 10;
        
        if (isNaN(cost) || cost <= 0) {
            alert("Ошибка: некорректное количество баллов.");
            return;
        }

        try {
            const response = await fetch('/exchange-points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ grade: selectedGrade, subject: selectedSubject, points: cost })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            alert(`Вы обменяли ${cost} баллов на оценку ${selectedGrade} по предмету ${selectedSubject}`);
            loadPoints();
        } catch (error) {
            alert(`Ошибка: ${error.message || 'Неизвестная ошибка'}`);
        }
    });

    notificationsBtn.addEventListener("click", () => {
        window.location.href = "/notifications.html";
    });

    loadTests();
    loadPoints();
});