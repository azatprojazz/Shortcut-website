// Длительность удержания для определения long press (в мс)
const holdDuration = 250;

/**
 * Формирует URL и отправляет его через Shortcuts.
 * Формат URL:
 * shortcuts://run-shortcut?name=COMMAND&input=text&text=TASK_ID
 *
 * Команда определяется по состоянию:
 *   - Done   – если state === "checked"
 *   - Check  – если state === "incomplete"
 *   - Cancel – если state === "cancelled"
 *
 * Для мобильных устройств используется ссылка с target="_blank",
 * для десктопа – iframe.
 *
 * @param {string} taskId - Уникальный идентификатор задачи.
 * @param {Object} params - Объект с параметрами состояния.
 */
function sendThingsRequest(taskId, params) {
  let commandName = '';
  if ('completed' in params) {
    commandName = params.completed ? 'Done' : 'Check';
  } else if ('canceled' in params) {
    commandName = 'Cancel';
  } else {
    console.error('Не указаны параметры состояния для задачи', taskId);
    return;
  }

  const url = `shortcuts://run-shortcut?name=${encodeURIComponent(commandName)}&input=text&text=${encodeURIComponent(
    taskId
  )}`;
  console.log('Отправляю URL:', url);

  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }
}

/**
 * Сохраняет состояние задачи в localStorage.
 * @param {string} taskId - Уникальный идентификатор задачи.
 * @param {string} state - Состояние ("incomplete", "checked", "cancelled").
 */
function saveState(taskId, state) {
  localStorage.setItem('taskState_' + taskId, state);
}

/**
 * Загружает состояние задачи из localStorage.
 * Если не найдено, возвращает "incomplete".
 * @param {string} taskId - Уникальный идентификатор задачи.
 * @returns {string} Состояние.
 */
function loadState(taskId) {
  return localStorage.getItem('taskState_' + taskId) || 'incomplete';
}

/**
 * Основная логика для каждого элемента задачи.
 * Обрабатывает клики, long press, touch-события и Alt/Option‑логику.
 * Состояние сохраняется в localStorage.
 */
const taskElems = document.querySelectorAll('.task');
taskElems.forEach(function (taskElem) {
  let taskId = taskElem.dataset.taskId;
  if (!taskId) {
    console.error('Не найден taskId для элемента:', taskElem);
    return;
  }

  // Загружаем сохраненное состояние или "incomplete"
  let state = loadState(taskId);
  let holdTimer = null;

  /**
   * Обновляет визуальное состояние элемента (через классы) и сохраняет состояние.
   */
  function updateUI() {
    taskElem.classList.remove('checked', 'cancelled');
    if (state === 'checked') {
      taskElem.classList.add('checked');
    } else if (state === 'cancelled') {
      taskElem.classList.add('cancelled');
    }
    saveState(taskId, state);
  }

  /**
   * Переключает состояние между "incomplete" и "checked".
   * Если состояние "cancelled", сбрасывает его в "incomplete".
   */
  function toggleComplete() {
    if (state === 'cancelled') {
      state = 'incomplete';
      updateUI();
      sendThingsRequest(taskId, { completed: false });
      return;
    }
    state = state === 'incomplete' ? 'checked' : 'incomplete';
    updateUI();
    sendThingsRequest(taskId, { completed: state === 'checked' });
  }

  /**
   * Устанавливает состояние "cancelled" (отмена задачи).
   */
  function cancelTask() {
    state = 'cancelled';
    updateUI();
    sendThingsRequest(taskId, { canceled: true });
  }

  /**
   * Обработчик начала нажатия (mousedown, touchstart).
   * Если нажата клавиша Alt/Option, выполняется логика отмены.
   * Иначе запускается таймер для определения long press.
   * @param {Event} e - событие.
   */
  function handleStart(e) {
    e.preventDefault();
    if (e.altKey) {
      if (state === 'cancelled') {
        state = 'incomplete';
        updateUI();
        sendThingsRequest(taskId, { completed: false });
      } else {
        cancelTask();
      }
      return;
    }
    holdTimer = setTimeout(function () {
      cancelTask();
      holdTimer = null;
    }, holdDuration);
  }

  /**
   * Обработчик завершения нажатия (mouseup, touchend).
   * Если таймер удержания еще активен, это обычный клик.
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

  taskElem.addEventListener('mousedown', handleStart);
  taskElem.addEventListener('mouseup', handleEnd);
  taskElem.addEventListener('mouseleave', handleCancel);
  taskElem.addEventListener('touchstart', handleStart);
  taskElem.addEventListener('touchend', handleEnd);
  taskElem.addEventListener('touchcancel', handleCancel);

  // Сразу обновляем UI для элемента
  updateUI();
});

// Когда все задачи обработаны, показываем содержимое страницы
document.body.style.display = 'block';