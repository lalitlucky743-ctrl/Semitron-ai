import { useState, useEffect, useCallback } from 'react';

export const useLocalStorage = (key, initialValue) => {

  const [value, setValue] = useState(() => {

    try {

      const item =
        window.localStorage.getItem(key);

      return item
        ? JSON.parse(item)
        : initialValue;

    } catch (error) {

      console.error(
        'LocalStorage read error:',
        error
      );

      return initialValue;

    }

  });


  const setStoredValue = useCallback(
    (newValue) => {

      try {

        setValue((currentValue) => {

          const valueToStore =
            typeof newValue === 'function'
              ? newValue(currentValue)
              : newValue;

          window.localStorage.setItem(
            key,
            JSON.stringify(valueToStore)
          );

          return valueToStore;

        });

      } catch (error) {

        console.error(
          'LocalStorage write error:',
          error
        );

      }

    },
    [key]
  );


  useEffect(() => {

    const handleStorageChange = (event) => {

      if (event.key !== key) {
        return;
      }


      try {

        setValue(
          event.newValue
            ? JSON.parse(event.newValue)
            : initialValue
        );

      } catch {

        setValue(initialValue);

      }

    };


    window.addEventListener(
      'storage',
      handleStorageChange
    );


    return () => {

      window.removeEventListener(
        'storage',
        handleStorageChange
      );

    };

  }, [key, initialValue]);


  return [
    value,
    setStoredValue,
  ];

};