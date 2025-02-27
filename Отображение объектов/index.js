// Безопасные функции для работы с localStorage
function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // Если localStorage недоступен, ничего не делаем
  }
}

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

  // Для всех устройств используем элемент <a> для открытия URL
  const a = document.createElement('a');
  a.href = url;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ==========================================================================
// Обработка отдельных задач (чекбоксов) с использованием data-атрибута для состояния.
// Для каждого элемента с классом "task" (у которого должен быть уникальный data-task-id)
// навешиваются обработчики событий для кликов, долгого нажатия и Alt+нажатия, а также определяется
// метод forceCompleteTask, который принудительно переводит задачу в состояние "Выполнено".
document.querySelectorAll('.task').forEach((taskElem) => {
  // Получаем уникальный идентификатор задачи из data-task-id
  const taskId = taskElem.dataset.taskId;
  if (!taskId) {
    console.error('Не найден data-task-id у элемента:', taskElem);
    return;
  }

  // Получаем сохранённое состояние из localStorage, если оно есть, иначе используем data-state или значение по умолчанию "Не выполнено"
  let storedState = safeLocalStorageGet('taskState_' + taskId);
  let state = storedState || (taskElem.dataset.state && taskElem.dataset.state.trim()) || 'Не выполнено';

  // ========================================================================
  // Функция: updateUI
  // Назначение: Обновляет визуальное отображение задачи на основе текущего состояния.
  //   1. Устанавливает data-атрибут "data-state" у элемента.
  //   2. Обновляет CSS-классы для применения стилей.
  //   3. Сохраняет состояние в localStorage.
  function updateUI() {
    taskElem.dataset.state = state;
    safeLocalStorageSet('taskState_' + taskId, state);

    // Удаляем старые классы состояния (если они были добавлены ранее)
    taskElem.classList.remove('checked', 'cancelled', 'incomplete');

    // Добавляем нужный класс для визуального отображения.
    // Если стили по data-атрибуту достаточно, этот шаг можно опустить.
    if (state === 'Выполнено') {
      taskElem.classList.add('checked');
    } else if (state === 'Отменено') {
      taskElem.classList.add('cancelled');
    } else {
      // Для "не выполнено" можно добавить отдельный класс, если потребуется
      taskElem.classList.add('incomplete');
    }
  }
  updateUI();

  // ========================================================================
  // Функция: toggleComplete
  // Переключает состояние задачи между "Не выполнено" и "Выполнено".
  // Если задача в состоянии "Отменено", сбрасывает её в "Не выполнено".
  function toggleComplete() {
    if (state === 'Отменено') {
      state = 'Не выполнено';
      updateUI();
      sendThingsRequest(taskId, { completed: false });
      return;
    }
    state = state === 'Не выполнено' ? 'Выполнено' : 'Не выполнено';
    updateUI();
    sendThingsRequest(taskId, { completed: state === 'Выполнено' });
  }

  // ========================================================================
  // Функция: cancelTask
  // Устанавливает состояние задачи "Отменено".
  function cancelTask() {
    state = 'Отменено';
    updateUI();
    sendThingsRequest(taskId, { canceled: true });
  }

  // ========================================================================
  // Функция: forceCompleteTask
  // Принудительно переводит задачу в состояние "Выполнено".
  // Параметр suppressRequest: если true, запрос через sendThingsRequest не отправляется.
  function forceCompleteTask(suppressRequest = false) {
    if (state !== 'Выполнено') {
      state = 'Выполнено';
      updateUI();
      if (!suppressRequest) {
        sendThingsRequest(taskId, { completed: true });
      }
    }
  }

  // Делаем метод forceCompleteTask доступным извне через DOM-элемент
  taskElem.forceCompleteTask = forceCompleteTask;

  // ========================================================================
  // Обработка событий для распознавания клика, долгого нажатия и нажатия с Alt
  let holdTimer = null;

  // Функция: handleStart
  // Назначение: Обрабатывает начало нажатия (mousedown / touchstart).
  // Если нажата клавиша Alt — сразу выполняем логику отмены/сброса отмены.
  // Иначе запускаем таймер для определения долгого нажатия.
  function handleStart(e) {
    e.preventDefault();
    if (e.altKey) {
      // Если Alt зажат и задача уже в состоянии "отменено", сбрасываем её в "не выполнено"
      if (state === 'Отменено') {
        state = 'Не выполнено';
        updateUI();
        sendThingsRequest(taskId, { completed: false });
      } else {
        cancelTask();
      }
      return;
    }
    // Запускаем таймер для определения долгого нажатия (200 мс)
    holdTimer = setTimeout(() => {
      cancelTask();
      holdTimer = null;
    }, 200);
  }

  // Функция: handleEnd
  // Назначение: Обрабатывает окончание нажатия (mouseup / touchend).
  // Если таймер активен — считаем, что это обычный клик и переключаем состояние.
  function handleEnd(e) {
    e.preventDefault();
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
      toggleComplete();
    }
  }

  // Функция: handleCancel
  // Назначение: Сбрасывает таймер, если нажатие было прервано (mouseleave / touchcancel).
  function handleCancel(e) {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  // Навешиваем обработчики событий для мыши и сенсорных устройств.
  taskElem.addEventListener('mousedown', handleStart);
  taskElem.addEventListener('mouseup', handleEnd);
  taskElem.addEventListener('mouseleave', handleCancel);
  taskElem.addEventListener('touchstart', handleStart, { passive: false });
  taskElem.addEventListener('touchend', handleEnd, { passive: false });
  taskElem.addEventListener('touchcancel', handleCancel, { passive: false });
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
    document.body.removeChild(iframe);
  }
}

// ==========================================================================
// Обработчик для кнопки "Завершить все задачи"
// При клике на кнопку:
//   1. Собираются все элементы с классом "task".
//   2. Извлекаются их уникальные data-task-id.
//   3. Отправляется один запрос для массового завершения.
//   4. Обновляется UI для каждой задачи (переводятся в состояние "Выполнено").
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
    // Обновляем UI для каждой задачи, переводя их в состояние "выполнено", без отправки индивидуальных запросов.
    taskElements.forEach((taskElem) => {
      if (typeof taskElem.forceCompleteTask === 'function') {
        taskElem.forceCompleteTask(true);
      }
    });
  }
});
