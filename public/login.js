document.addEventListener("DOMContentLoaded", async () => {
    const loginForm = document.getElementById("login-form");

    // ✅ Проверяем, авторизован ли пользователь
    try {
        const response = await fetch("/user-info", { credentials: "include" });

        if (response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const userData = await response.json();

                console.log("🔹 Проверка авторизации:", userData);

                if (userData.role === "teacher") {
                    if (!userData.subject) {
                        console.log("🔸 Перенаправление на выбор предмета");
                        window.location.href = "/select_subject.html";
                        return;
                    }
                    window.location.href = "/teacher_dashboard.html";
                } else {
                    window.location.href = "/student_dashboard.html";
                }
            }
        }
    } catch (err) {
        console.warn("🔹 Пользователь не авторизован:", err);
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const username = document.getElementById("username").value.trim();
            const password = document.getElementById("password").value.trim();

            if (!username || !password) {
                alert("Введите логин и пароль!");
                return;
            }

            try {
                const response = await fetch("/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                    credentials: "include" // ✅ Отправка сессионных куки
                });

                const contentType = response.headers.get("content-type");
                let data = {};

                if (contentType && contentType.includes("application/json")) {
                    data = await response.json();
                } else {
                    throw new Error("Ошибка сервера: " + await response.text());
                }

                if (!response.ok) {
                    throw new Error(data.message || "Ошибка авторизации");
                }

                console.log("🔹 Успешный вход! Данные пользователя:", data);

                // ✅ Перенаправление на нужную страницу
                if (data.success) {
                    if (data.role === "teacher") {
                        if (!data.subject) {
                            console.log("🔸 Перенаправление на выбор предмета");
                            window.location.href = "/select_subject.html";
                        } else {
                            window.location.href = "/teacher_dashboard.html";
                        }
                    } else {
                        window.location.href = "/student_dashboard.html";
                    }
                }
            } catch (error) {
                console.error("❌ Ошибка входа:", error);
                alert(error.message);
            }
        });
    }
});