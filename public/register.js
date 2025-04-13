document.getElementById('registerForm').addEventListener('submit', async (event) => {
    event.preventDefault(); // Останавливаем стандартное поведение формы

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = document.querySelector('input[name="role"]:checked').value;

    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
    });

    if (response.ok) {
        alert('Регистрация успешна! Перенаправляем...');
        window.location.href = '/login.html'; // Перенаправление на страницу входа
    } else {
        const errorText = await response.text();
        alert(`Ошибка: ${errorText}`);
    }
});