const choice = (id, prompt, expectedAnswer, acceptedAnswers, suggestions, correction) => ({ id, type: 'choice', prompt, expectedAnswer, acceptedAnswers, suggestions, correction });
const open = (id, prompt, acceptedAnswers, suggestions) => ({ id, type: 'open', prompt, expectedAnswer: null, acceptedAnswers, suggestions, correction: null });

const lessons = {
  school: [
    choice('school-pencil', 'What is this? ✏️', 'pencil', ['pencil', 'a pencil', "it's a pencil", 'it is a pencil'], ['A pencil.', 'A book.', 'A ruler.'], "It's a pencil. ✏️"),
    choice('school-book', 'What is this? 📘', 'book', ['book', 'a book', "it's a book", 'it is a book'], ['A book.', 'A ruler.', 'A notebook.'], "It's a book. 📘"),
    choice('school-bag', 'What is this? 🎒', 'school bag', ['school bag', 'a school bag', "it's a school bag", 'it is a school bag'], ['A school bag.', 'A book.', 'A desk.'], "It's a school bag. 🎒"),
    choice('school-pen', 'What is this? 🖊️', 'pen', ['pen', 'a pen', "it's a pen", 'it is a pen'], ['A pen.', 'A pencil.', 'A ruler.'], "It's a pen. 🖊️"),
    choice('school-ruler', 'What is this long school thing? 📏', 'ruler', ['ruler', 'a ruler', "it's a ruler", 'it is a ruler'], ['A ruler.', 'A pen.', 'A chair.'], "It's a ruler. 📏"),
    choice('school-rubber', 'What do we use to erase pencil marks?', 'rubber', ['rubber', 'a rubber', "it's a rubber", 'it is a rubber', 'eraser', 'an eraser'], ['A rubber.', 'A notebook.', 'A desk.'], "It's a rubber."),
    choice('school-pencil-case', 'Where do pencils and pens go?', 'pencil case', ['pencil case', 'a pencil case', 'in a pencil case', "it's a pencil case", 'it is a pencil case'], ['A pencil case.', 'A school bag.', 'A book.'], "It's a pencil case."),
    choice('school-desk', 'What do pupils write on?', 'desk', ['desk', 'a desk', 'on a desk', "it's a desk", 'it is a desk'], ['A desk.', 'A chair.', 'A book.'], "It's a desk."),
    choice('school-chair', 'What do pupils sit on?', 'chair', ['chair', 'a chair', 'on a chair', "it's a chair", 'it is a chair'], ['A chair.', 'A desk.', 'A school bag.'], "It's a chair."),
    choice('school-teacher', 'Who helps children learn at school? 👩‍🏫', 'teacher', ['teacher', 'a teacher', 'the teacher', "it's a teacher", 'it is a teacher'], ['A teacher.', 'A pupil.', 'A grandma.'], "It's a teacher. 👩‍🏫"),
    choice('school-notebook', 'What do you write lessons in? 📓', 'notebook', ['notebook', 'a notebook', "it's a notebook", 'it is a notebook'], ['A notebook.', 'A ruler.', 'A chair.'], "It's a notebook. 📓"),
    choice('school-place', 'Where do children learn with a teacher?', 'school', ['school', 'at school', "it's a school", 'it is a school'], ['School.', 'Home.', 'A shop.'], "It's a school. 🏫")
  ],
  family: [
    choice('family-mum', 'Who is this? 👩', 'mum', ['mum', 'my mum', "it's my mum", 'it is my mum', "it's your mum", 'it is your mum', 'mother', 'my mother'], ["It's your mum.", "It's your sister.", "It's your grandma."], "It's my mum. 👩"),
    choice('family-dad', 'This man is the father. Who is he? 👨', 'dad', ['dad', 'my dad', "it's my dad", 'it is my dad', 'father', 'my father'], ["It's the dad.", "It's the brother."], "It's the dad. 👨"),
    choice('family-brother', 'This boy has the same parents as the girl. Who is he?', 'brother', ['brother', 'my brother', "it's my brother", 'it is my brother', 'her brother'], ["It's her brother.", "It's her grandpa."], "It's her brother."),
    choice('family-sister', 'This girl has the same parents as the boy. Who is she?', 'sister', ['sister', 'my sister', "it's my sister", 'it is my sister', 'his sister'], ["It's his sister.", "It's his grandma."], "It's his sister."),
    choice('family-grandma', "Mila's mother's mum is in the photo. Who is she?", 'grandma', ['grandma', 'my grandma', "it's her grandma", 'it is her grandma', 'grandmother'], ["It's her grandma.", "It's her mum."], "It's her grandma."),
    choice('family-grandpa', "Mila's father's dad is in the photo. Who is he?", 'grandpa', ['grandpa', 'my grandpa', "it's her grandpa", 'it is her grandpa', 'grandfather'], ["It's her grandpa.", "It's her dad."], "It's her grandpa."),
    choice('family-group', 'Mum, dad and children are a ...', 'family', ['family', 'a family', 'the family', "it's a family", 'it is a family'], ['A family.', 'A school.'], "It's a family. 💕"),
    choice('family-this-mum', "Complete: 'This is my ...' 👩", 'mum', ['mum', 'this is my mum', 'my mum'], ['This is my mum.', 'This is my dad.'], "This is my mum."),
    choice('family-got-sister', "Complete: 'I've got a ...' 👧", 'sister', ['sister', 'a sister', "i've got a sister", 'i have got a sister'], ["I've got a sister.", "I've got a brother."], "I've got a sister."),
    open('family-have', 'Have you got a brother or a sister?', ['yes', 'no', 'brother', 'sister'], ['Yes, I have.', "No, I haven't.", "I've got a sister."])
  ],
  food: [
    open('food-like', 'What food do you like?', ['i like', 'pizza', 'apple', 'banana', 'ice cream'], ['I like apples.', 'I like pizza.', 'I like ice cream.']),
    choice('food-apple', 'What is this red fruit? 🍎', 'apple', ['apple', 'an apple', "it's an apple", 'it is an apple'], ['An apple.', 'A banana.', 'A pizza.'], "It's an apple. 🍎"),
    choice('food-banana', 'What is this yellow fruit? 🍌', 'banana', ['banana', 'a banana', "it's a banana", 'it is a banana'], ['A banana.', 'An apple.', 'Bread.'], "It's a banana. 🍌"),
    choice('food-pizza', 'What is this? 🍕', 'pizza', ['pizza', 'a pizza', "it's pizza", 'it is pizza', "it's a pizza", 'it is a pizza'], ['Pizza.', 'Cake.', 'Chicken.'], "It's pizza. 🍕"),
    choice('food-ice-cream', 'What cold sweet food is this? 🍦', 'ice cream', ['ice cream', 'an ice cream', "it's ice cream", 'it is ice cream'], ['Ice cream.', 'Milk.', 'Cake.'], "It's ice cream. 🍦"),
    choice('food-milk', 'What white drink comes from cows? 🥛', 'milk', ['milk', "it's milk", 'it is milk'], ['Milk.', 'Juice.', 'Water.'], "It's milk. 🥛"),
    choice('food-juice', 'What fruit drink is this? 🧃', 'juice', ['juice', "it's juice", 'it is juice', 'fruit juice'], ['Juice.', 'Milk.', 'Tea.'], "It's juice. 🧃"),
    open('food-fish', 'Do you like fish? 🐟', ['yes i do', 'no i do not', "no i don't", 'i like fish', "i don't like fish"], ['Yes, I do.', "No, I don't.", 'I like fish.']),
    choice('food-chicken', 'Which food comes from a hen?', 'chicken', ['chicken', "it's chicken", 'it is chicken'], ['Chicken.', 'Fish.', 'Bread.'], "It's chicken."),
    choice('food-cake', 'What sweet party food has candles? 🎂', 'cake', ['cake', 'a cake', "it's a cake", 'it is a cake'], ['A cake.', 'Bread.', 'Pizza.'], "It's a cake. 🎂"),
    choice('food-bread', 'What food do we use for a sandwich? 🍞', 'bread', ['bread', "it's bread", 'it is bread'], ['Bread.', 'Cake.', 'Fish.'], "It's bread. 🍞")
  ]
};

function normalizeAnswer(value) {
  return String(value || '').toLowerCase().trim().replace(/[’‘]/g, "'").replace(/[.!?,;:]+$/g, '').replace(/\s+/g, ' ');
}

function validateAnswer(exercise, answer) {
  if (exercise.type === 'open') return { correct: null, normalized: normalizeAnswer(answer) };
  const normalized = normalizeAnswer(answer);
  return { correct: exercise.acceptedAnswers.some(value => normalizeAnswer(value) === normalized), normalized };
}

function getExercise(topic, index) { const items = lessons[topic]; return items[index % items.length]; }

function getChoiceExercise(topic, startIndex = 0) {
  const items = lessons[topic];
  for (let offset = 0; offset < items.length; offset += 1) {
    const index = (startIndex + offset) % items.length;
    if (items[index].type === 'choice') return { exercise: items[index], index };
  }
  throw new Error(`No choice exercise configured for ${topic}`);
}

function isConversationalMessage(message, exercise) {
  const normalized = normalizeAnswer(message);
  if (exercise && validateAnswer(exercise, message).correct === true) return false;
  if (String(message).trim().endsWith('?')) return true;
  const conversational = /^(?:hi|hello|hey|thank you|thanks)\b|\b(?:what is your|what's your|do you like|how are you|my favou?rite|i think|i want|i like|i don't like|i do not like)\b/i;
  if (conversational.test(normalized)) return true;
  const words = normalized.split(' ').filter(Boolean);
  if (words.length > 5) return true;
  if (!exercise) return true;
  const answerLike = /^(?:(?:a|an|the)\s+)?[a-z' -]+$|^(?:it is|it's|this is)\s+/i;
  return !answerLike.test(normalized);
}

module.exports = { lessons, normalizeAnswer, validateAnswer, getExercise, getChoiceExercise, isConversationalMessage };
