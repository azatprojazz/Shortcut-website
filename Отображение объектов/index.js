document.addEventListener('DOMContentLoaded', function () {
  // ==========================================================================
  // Функции для обновления href ссылок (обрабатываются все элементы с классом .link)
  // ==========================================================================
  function getOriginalUrl(link) {
    return link.getAttribute('data-original-url') || link.href;
  }

  function isMobile() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || /Mobi/.test(navigator.userAgent);
  }

  function updateLinks() {
    // Выбираем все ссылки с классом .link
    const links = document.querySelectorAll('.link');
    links.forEach((link) => {
      const originalUrl = getOriginalUrl(link);
      if (isMobile()) {
        // Если устройство мобильное – формируем URL для вызова шортката
        link.href = `shortcuts://run-shortcut?name=Links&input=text&text=${encodeURIComponent(originalUrl)}`;
      } else {
        // На десктопе оставляем оригинальный URL
        link.href = originalUrl;
      }
    });
  }

  updateLinks();


// ==========================================================================
// Функция: sendThingsRequest
// Назначение: Отправляет запрос через схему Shortcuts для обновления состояния задачи.
// Параметры:
//   - taskId: уникальный идентификатор задачи.
//   - params: объект с параметрами состояния, например: { completed: true } или { canceled: true }.
// Формирует URL вида:
//   shortcuts://run-shortcut?name=COMMAND&input=text&text=TASK_ID
// и открывает его, используя временный элемент ссылки или iframe.
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

  // Для touch-устройств (iOS, iPadOS)
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    const a = document.createElement('a');
    a.href = url;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    // Для десктопа используем iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 500);
  }
}

// ==========================================================================
// Обработка отдельных задач
// Для каждого элемента с классом "task" (у которого должен быть уникальный data-task-id)
// навешиваются обработчики событий для кликов, долгого нажатия и Alt+нажатия, а также определяется
// метод forceCompleteTask, который принудительно переводит задачу в состояние "выполнено".
document.querySelectorAll('.task').forEach((taskElem) => {
  let taskId = taskElem.dataset.taskId;
  if (!taskId) {
    console.error('Не найден data-task-id у элемента:', taskElem);
    return;
  }

  // Возможные состояния задачи: "incomplete" (не выполнена), "checked" (выполнена), "cancelled" (отменена)
  let state = 'incomplete';
  let holdTimer = null;

  // Обновляет визуальное отображение задачи, добавляя соответствующие классы.
  function updateUI() {
    taskElem.classList.remove('checked', 'cancelled');
    if (state === 'checked') {
      taskElem.classList.add('checked');
    } else if (state === 'cancelled') {
      taskElem.classList.add('cancelled');
    }
  }

  // Переключает состояние задачи между "incomplete" и "checked". Если задача отменена, сбрасывает её в "incomplete".
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

  // Устанавливает состояние задачи "cancelled".
  function cancelTask() {
    state = 'cancelled';
    updateUI();
    sendThingsRequest(taskId, { canceled: true });
  }

  // Принудительное завершение задачи. Если задача ещё не выполнена, переводит её в "checked".
  // Добавлен параметр suppressRequest, чтобы можно было обновить UI без отправки индивидуального запроса при массовом завершении.
  function forceCompleteTask(suppressRequest = false) {
    if (state !== 'checked') {
      state = 'checked';
      updateUI();
      if (!suppressRequest) {
        sendThingsRequest(taskId, { completed: true });
      }
    }
  }

  // Делаем метод forceCompleteTask доступным из вне через сам DOM-элемент,
  // чтобы его можно было вызывать при массовом завершении.
  taskElem.forceCompleteTask = forceCompleteTask;

  // Обработчик начала нажатия (mousedown / touchstart).
  // Если нажата клавиша Alt, сразу выполняется логика отмены.
  // Иначе запускается таймер для определения долгого нажатия.
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
    holdTimer = setTimeout(() => {
      cancelTask();
      holdTimer = null;
    }, 200); // 200 мс для определения long press
  }

  // Обработчик окончания нажатия (mouseup / touchend).
  // Если таймер активен, значит это обычный клик – переключаем состояние.
  function handleEnd(e) {
    e.preventDefault();
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
      toggleComplete();
    }
  }

  // Обработчик отмены нажатия (mouseleave / touchcancel) – сбрасывает таймер.
  function handleCancel(e) {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  // Навешиваем обработчики событий для мыши и touch.
  taskElem.addEventListener('mousedown', handleStart);
  taskElem.addEventListener('mouseup', handleEnd);
  taskElem.addEventListener('mouseleave', handleCancel);
  taskElem.addEventListener('touchstart', handleStart);
  taskElem.addEventListener('touchend', handleEnd);
  taskElem.addEventListener('touchcancel', handleCancel);
});

// ==========================================================================
// Массовое завершение задач через один вызов шортката
// Чтобы избежать ситуации, когда iOS/Shortcuts игнорирует быстрые последовательные вызовы,
// мы собираем все taskId в один массив, объединяем их в строку (через запятую)
// и отправляем один запрос в Shortcut с именем "Done".
// Внутри Shortcut тебе нужно:
//   1. Получить входной текст (строку с ID, разделёнными запятыми).
//   2. Разбить строку на массив (используя запятую как разделитель).
//   3. Для каждого элемента массива выполнить логику завершения задачи.
function sendMassCompleteRequest(taskIds) {
  // Используем ту же команду "Done"
  const shortcutName = 'Done';

  // Объединяем все taskId в одну строку, разделённую запятыми.
  const joinedIds = taskIds.join(',');

  // Формируем URL для вызова шортката.
  const url = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}&input=text&text=${encodeURIComponent(
    joinedIds
  )}`;
  console.log('Отправляю массовый запрос с URL:', url);

  // Аналогично, открываем ссылку для мобильных и десктопных устройств.
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    const a = document.createElement('a');
    a.href = url;
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
    }, 500);
  }
}

// ==========================================================================
// Обработчик для кнопки "Завершить все задачи"
// При клике на кнопку собираем все элементы с классом "task", извлекаем их уникальные data-task-id,
// формируем из них массив и вызываем sendMassCompleteRequest, который отправляет один общий запрос.
// Также обновляем UI для каждой задачи, помечая их как завершённые.
document.getElementById('complete-all').addEventListener('click', () => {
  // Находим все элементы задач.
  const taskElements = document.querySelectorAll('.task');

  // Собираем все taskId в массив.
  const taskIds = [];
  taskElements.forEach((taskElem) => {
    if (taskElem.dataset.taskId) {
      taskIds.push(taskElem.dataset.taskId);
    }
  });

  // Если найдены задачи, отправляем их все одним запросом.
  if (taskIds.length > 0) {
    sendMassCompleteRequest(taskIds);
    // Обновляем UI для каждой задачи, помечая их как завершённые, без отправки индивидуальных запросов.
    taskElements.forEach((taskElem) => {
      if (typeof taskElem.forceCompleteTask === 'function') {
        taskElem.forceCompleteTask(true);
      }
    });
  } else {
    console.log('Нет задач для завершения.');
  }
  });
});
