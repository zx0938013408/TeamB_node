import bcrypt from "bcrypt";

const my_pw = '123456';

const hash = '$2b$10$nHhquYIDY9JIvJRqhh4EaO52jQ2WmUOM55ii2WlVVLj4g9qQ5U5ae';

// 比對 hash 是否是從該密碼來的
console.log(await bcrypt.compare(my_pw, hash));

