let controller = new AbortController();
const notificationsContainer = document.getElementById("notifications-container");

async function fetchNotifications() {
    try {
        if (controller) controller.abort();
        controller = new AbortController();

        const response = await fetch("/get-notifications", {
            method: "GET",
            credentials: "include",
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }

        const data = await response.json();
        console.log("📨 Полученные уведомления:", data.notifications);

        notificationsContainer.innerHTML = "";

        if (!data.notifications || data.notifications.length === 0) {
            notificationsContainer.innerHTML = '<p class="no-notifications">Нет новых уведомлений</p>';
            return;
        }

        data.notifications.forEach(notification => {
            const div = document.createElement("div");
            div.className = "notification";

            if (notification.type === "points_exchange") {
                div.textContent = `Ученик ${notification.sender} обменял ${notification.points} баллов на оценку: ${notification.grade} по ${notification.subject}`;

                const confirmBtn = document.createElement("button");
                confirmBtn.className = "confirm-btn";
                confirmBtn.textContent = "Подтвердить";
                confirmBtn.onclick = async () => {
                    try {
                        const response = await fetch("/resolve-notification", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ notificationId: notification._id }),
                            credentials: "include"
                        });

                        if (!response.ok) {
                            throw new Error("Ошибка при подтверждении уведомления");
                        }

                        fetchNotifications();
                    } catch (error) {
                        alert(error.message);
                    }
                };

                div.appendChild(confirmBtn);
            } else if (notification.type === "grade_assigned") {
                div.textContent = `Учитель ${notification.sender} выставил вам оценку: ${notification.grade} по ${notification.subject}`;

                const deleteBtn = document.createElement("button");
                deleteBtn.className = "delete-btn";
                deleteBtn.textContent = "Удалить";
                deleteBtn.onclick = async () => {
                    div.remove();
                };

                div.appendChild(deleteBtn);
            }

            notificationsContainer.appendChild(div);
        });
    } catch (error) {
        console.error("❌ Ошибка при загрузке уведомлений:", error);
        notificationsContainer.innerHTML = '<p class="no-notifications">Ошибка загрузки уведомлений</p>';
    }
}

// Автообновление уведомлений
const intervalId = setInterval(fetchNotifications, 10000);

// Очищаем интервал при закрытии страницы
window.addEventListener("beforeunload", () => clearInterval(intervalId));

// Загружаем уведомления при открытии страницы
fetchNotifications();