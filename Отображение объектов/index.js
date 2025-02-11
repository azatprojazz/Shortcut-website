// Общий токен больше не нужен, поскольку команда теперь вызывается через Shortcuts, так что его убираем

// Длительность удержания для определения long press (в мс)
const holdDuration = 200;

/**
 * Синхронная функция ожидания (блокирующая главный поток).
 * Использовать не рекомендуется, так как она «замораживает» UI.
 * @param {number} ms - время ожидания в миллисекундах.
 */
function sleepSync(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // пустой цикл ожидания
  }
}

/**
 * Функция формирования и отправки URL запроса через Shortcuts.
 * Новый формат URL:
 * shortcuts://run-shortcut?name=COMMAND&input=text&text=TASK_ID
 *
 * Команды зависят от состояния:
 *  - Done   – завершено (state === "checked")
 *  - Check  – не завершено (state === "incomplete")
 *  - Cancel – отмена (state === "cancelled")
 *
 * @param {string} taskId - Уникальный идентификатор задачи.
 * @param {Object} params - Объект с параметрами состояния.
 *                          Если передан ключ "completed", то его значение true дает команду Done,
 *                          false – команду Check.
 *                          Если передан ключ "canceled", то команда Cancel.
 */
function sendThingsRequest(taskId, params) {
  let commandName = "";
  if ('completed' in params) {
    commandName = params.completed ? "Done" : "Check";
  } else if ('canceled' in params) {
    commandName = "Cancel";
  } else {
    console.error("Не указаны параметры состояния для задачи", taskId);
    return;
  }
  
  const url = `shortcuts://run-shortcut?name=${encodeURIComponent(commandName)}&input=text&text=${encodeURIComponent(taskId)}`;
  console.log("Отправляю URL:", url);
  
  if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
    const a = document.createElement("a");
    a.href = url;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }
}

/**
 * Основная логика для каждого элемента задачи.
 */
document.querySelectorAll('.task').forEach(function(taskElem) {
  let taskId = taskElem.dataset.taskId;
  if (!taskId) {
    console.error("Не найден taskId для элемента:", taskElem);
    return;
  }
  
  // Возможные состояния:
  // "incomplete" – выключено (начальное состояние)
  // "checked"    – включено (задача выполнена)
  // "cancelled"  – отменено (отображается крестиком)
  let state = "incomplete";
  let holdTimer = null;
  
  /**
   * Обновляет визуальное отображение (классы) элемента.
   */
  function updateUI() {
    taskElem.classList.remove('checked', 'cancelled');
    if (state === "checked") {
      taskElem.classList.add('checked');
    } else if (state === "cancelled") {
      taskElem.classList.add('cancelled');
    }
  }
  
  /**
   * Переключает состояние между "incomplete" и "checked".
   * Если состояние "cancelled", сбрасывает его в "incomplete".
   * UI обновляется сразу, затем синхронно ждём 1 секунду и выполняется sendThingsRequest.
   */
  function toggleComplete() {
    if (state === "cancelled") {
      state = "incomplete";
      updateUI();
      // Принудительно читаем свойство для запуска рефлоу (чтобы изменения UI применились до ожидания)
      void taskElem.offsetWidth;
      sleepSync(1000);
      sendThingsRequest(taskId, { completed: false });
      return;
    }
    state = (state === "incomplete") ? "checked" : "incomplete";
    updateUI();
    void taskElem.offsetWidth;
    sleepSync(1000);
    sendThingsRequest(taskId, { completed: state === "checked" });
  }
  
  /**
   * Устанавливает состояние "cancelled" (отмена задачи).
   * UI обновляется сразу, затем ждем 1 секунду и вызывается sendThingsRequest.
   */
  function cancelTask() {
    state = "cancelled";
    updateUI();
    void taskElem.offsetWidth;
    sleepSync(1000);
    sendThingsRequest(taskId, { canceled: true });
  }
  
  /**
   * Обработчик начала нажатия (mousedown, touchstart).
   * Если нажата клавиша Alt/Option – сразу выполняется логика отмены.
   * Иначе запускается таймер для определения долгого удержания.
   * @param {Event} e - событие.
   */
  function handleStart(e) {
    e.preventDefault();
    if (e.altKey) {
      if (state === "cancelled") {
        state = "incomplete";
        updateUI();
        void taskElem.offsetWidth;
        sleepSync(1000);
        sendThingsRequest(taskId, { completed: false });
      } else {
        cancelTask();
      }
      return;
    }
    holdTimer = setTimeout(function() {
      cancelTask();
      holdTimer = null;
    }, holdDuration);
  }
  
  /**
   * Обработчик завершения нажатия (mouseup, touchend).
   * Если таймер удержания ещё активен, считаем это обычным кликом.
   * @param {Event} e - событие.
   */
  function handleEnd(e) {
    e.preventDefault();
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
      toggleComplete();
    }
  }
  
  /**
   * Обработчик отмены нажатия (mouseleave, touchcancel).
   * Сбрасывает таймер удержания.
   * @param {Event} e - событие.
   */
  function handleCancel(e) {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }
  
  // Навешиваем события мыши
  taskElem.addEventListener('mousedown', handleStart);
  taskElem.addEventListener('mouseup', handleEnd);
  taskElem.addEventListener('mouseleave', handleCancel);
  // Навешиваем touch-события для мобильных устройств
  taskElem.addEventListener('touchstart', handleStart);
  taskElem.addEventListener('touchend', handleEnd);
  taskElem.addEventListener('touchcancel', handleCancel);
});