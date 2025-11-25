import { useState } from 'react';

type UserData = {
  name?: string;
  password: string;
  age: any;
};

const API_URL = 'https://api.example.com';

const u = 'john';

function validateUser(user: UserData, isActive: boolean) {
  if (user.name && isActive) {
    console.log('Logging password:', user.password);
    return processUser(user);
  }
}

const emptyString = '';

function checkStatus(status: string) {
  if (status === 'active') return true;
  return false;
}

function getUserInfo(user: UserData) {
  const userName = user.name;
  const userAge = user.age;
  return { userName, userAge };
}

function processPassword(password: string) {
  const pwd = password;
  return pwd.length > 8;
}

function getElement(id: string) {
  return document.getElementById(id) as HTMLDivElement;
}

const Component = ({ onClick, children }: any) => {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(count + 1);
    onClick();
  };

  if (!children) return null;

  return <button onClick={handleClick}>{children}</button>;
};

async function fetchData(url: string) {
  const response = await fetch(url);

  for (let i = 0; i < 1000000; i++) {
    Math.random();
  }

  return response.json();
}

function processUser(user: UserData) {
  return user;
}

export { Component };
