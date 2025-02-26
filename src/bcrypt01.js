import bcrypt from "bcrypt";

const my_pw = '123456';

const hash = await bcrypt.hash(my_pw, 10);

console.log(hash);

