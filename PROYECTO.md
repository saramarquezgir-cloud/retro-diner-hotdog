# 🌭 Retro Diner Hot Dog - Documento de Proyecto

Documento de visión, diseño y arquitectura inicial para el desarrollo del videojuego web **Retro Diner Hot Dog**.

---

## 1. Qué hace la app

**Retro Diner Hot Dog** es un videojuego web casual de simulación de cocina y gestión de tiempo ambientado en un clásico *diner* estadounidense de los años 50.

* **Objetivo principal**: El jugador asume el rol del cocinero detrás de la barra, atendiendo a clientes hambrientos preparando y entregando pedidos de perros calientes personalizados contra reloj.
* **Mecánica central (Core Loop)**:
  1. Llega un cliente y se posiciona frente al mostrador.
  2. Aparece un globo de diálogo flotante con la receta solicitada (combinación de pan, salchicha cocida, salsas y aderezos) y un indicador de paciencia que disminuye con el tiempo.
  3. El jugador cocina la salchicha en la parrilla caliente, monta el pan, coloca la salchicha en su punto y añade los ingredientes exactos.
  4. Entrega el pedido arrastrándolo hacia el cliente antes de que se agote su paciencia.
* **Sistema de recompensa y progresión**:
  * **Puntaje**: Se otorgan puntos según la precisión de la receta y la rapidez de la entrega.
  * **Propinas**: Los clientes entregan monedas extra si reciben su comida rápidamente con la barra de paciencia alta.
  * **Niveles progresivos**: A medida que se superan niveles, los clientes llegan con mayor frecuencia, su paciencia decae más rápido y las órdenes se vuelven progresivamente más exigentes.
* **Alcance de la versión 1 (MVP)**:
  * Mecánica simplificada enfocada en un flujo ágil: **un solo cliente a la vez** frente al mostrador.
  * Catálogo esencial de ingredientes: pan de perro caliente, salchicha (cruda/en cocción/cocinada), mostaza, ketchup, cebolla picada y queso rallado.

---

## 2. Quién la usa

* **Perfil del usuario**:
  * Jugadores casuales de todas las edades que disfrutan de juegos de simulación gastronómica, cocina y gestión ágil de tiempo (estilo *Papa's Hot Doggeria*, *Overcooked* o *Cook, Serve, Delicious*).
  * Aficionados a la estética nostálgica *mid-century*, el arte retro de los años 50 y la temática *rockabilly / diner*.
* **Plataforma y entorno de uso**:
  * Diseñado específicamente para **navegadores web en computadores de escritorio y portátiles** (Chrome, Safari, Firefox, Edge).
  * Interacción rápida y accesible directamente desde la web, sin descargas pesadas ni instalaciones complejas.

---

## 3. Qué elementos 3D tendrá y con qué estética

Todos los elementos visuales tridimensionales se diseñan y modelan en **Blender** y se exportan para su renderizado web optimizado (mediante Three.js / WebGL).

* **Estética visual**:
  * **Estilo Cartoon / Toon con sombreado plano (cel shading / flat shading)** y contornos marcados, evocando las ilustraciones publicitarias, anuncios vintage y cómics de los años 50.
  * **Paleta cromática retro vibrante**: Tonos pastel combinados con acentos vivos como turquesa pastel, rojo cereza, amarillo mostaza, blanco crema y acentos cromados brillantes.
* **Elementos 3D modelados**:
  1. **Cocina y Mostrador**:
     * Mostrador de formica retro con bordes metálicos de aluminio/cromo.
     * Parrilla plana de acero con ranuras y marcas de calor.
     * Bandeja / plato de entrega donde se ensambla y presenta el pedido.
     * Recipientes / insertos para ingredientes frescos (cebolla y queso).
     * Dispensadores clásicos tipo biberón para ketchup (rojo) y mostaza (amarillo).
  2. **Ingredientes de comida**:
     * Pan de perro caliente (abierto y listo para recibir ingredientes).
     * Salchichas con estados visuales diferenciados (cruda, en punto de cocción con vapor/humo ligero, quemada si se pasa de tiempo).
     * Salsas modeladas con mallas fluidas onduladas (ketchup brillante y mostaza).
     * Toppings volumétricos: dados de cebolla fresca y tiras de queso cheddar fundido.
  3. **Personajes y Clientes (3D Estilizados)**:
     * Modelos 3D de clientes con vestimenta retro de los 50 (chaquetas de cuero, camisas a cuadros, vestidos de lunares, peinados tupé y peinados altos).
     * Animaciones sencillas de llegada al mostrador, espera y reacciones gestuales (alegría/saludo con propina al recibir la orden a tiempo, o enfado y retirada si expira la paciencia).
  4. **Entorno de fondo (Diner)**:
     * Suelo de baldosas en damero blanco y negro.
     * Máquina de discos (jukebox) o letreros de neón en la pared de fondo.

---

## 4. Qué ve la persona en pantalla

La interfaz combina un entorno 3D inmersivo con una capa de interfaz de usuario (HUD) limpia y temática.

* **Perspectiva de cámara**:
  * **Primera persona frontal fija detrás del mostrador**: El jugador ve la acción desde los ojos del cocinero, teniendo acceso inmediato con el mouse a toda la superficie de trabajo.
* **Distribución de la pantalla**:
  * **Plano medio / superior (Frente al mostrador)**:
    * El cliente 3D de pie esperando pacientemente su orden.
    * **Globo de diálogo flotante (Speech Bubble)**: Muestra de forma gráfica la receta solicitada (iconos del pan, salchicha y salsas/toppings necesarios).
    * **Barra de paciencia**: Medidor visual dinámico (verde ➔ amarillo ➔ rojo) o reloj retro que indica cuánto tiempo queda antes de que el cliente se marche enojado.
  * **Plano inferior / primer plano (Superficie del mostrador)**:
    * **Zona izquierda**: La parrilla caliente para colocar y vigilar las salchichas.
    * **Zona central**: El plato/área de trabajo para colocar el pan y armar el perro caliente.
    * **Zona derecha**: Los ingredientes secundarios (botes de ketchup y mostaza, tazones de cebolla y queso).
  * **HUD (Interfaz de juego superior)**:
    * Marcador de puntuación acumulada.
    * Tarro de propinas con dinero ganado.
    * Indicador de nivel actual y clientes restantes en la jornada.

---

## 5. Qué puede hacer

La jugabilidad está diseñada para ser 100% intuitiva, basada exclusivamente en el **mouse mediante clic y arrastrar (drag & drop)**:

1. **Cocinar la salchicha**:
   * Hacer clic sobre una salchicha cruda y arrastrarla hacia la superficie de la parrilla.
   * Monitorear visualmente el punto de cocción (cambia de color y suelta chispas/humo cuando está lista).
   * Si se deja demasiado tiempo, se quema y debe desecharse al bote de basura.
2. **Preparar el pan**:
   * Hacer clic en un pan fresco y arrastrarlo al plato central de ensamblaje.
3. **Montar la salchicha**:
   * Tomar la salchicha cocida desde la parrilla con el mouse y depositarla dentro del pan abierto.
4. **Aderezar y personalizar**:
   * Arrastrar los botes de salsa (ketchup/mostaza) sobre el perro caliente para aplicar el aderezo.
   * Tomar porciones de cebolla picada o queso y soltarlas sobre el perro caliente.
5. **Entregar la orden**:
   * Arrastrar el plato con el perro caliente terminado directamente hacia el cliente o su globo de pedido.
   * El sistema evalúa la coincidencia de ingredientes:
     * **Orden perfecta y rápida**: Puntaje máximo + propina generosa + animación feliz del cliente.
     * **Orden con errores o tardía**: Menor puntaje, propina reducida o penalización si el cliente se marcha.

---

## 6. Qué se comparte entre usuarios

Para fomentar la rejugabilidad, el desafío personal y la comunidad:

* **Reto 1 vs 1 en Tiempo Real (Duelo de Perros Calientes)**:
  * Dos personas pueden conectarse en directo mediante un código de sala simple (ej: `DINER-88`) o enlace de invitación.
  * **Modo Batalla de 60 segundos**: Ambos cocineros compiten simultáneamente preparando pedidos en sus respectivas barras.
  * **Marcador en vivo**: Los jugadores ven en tiempo real cuántos perros calientes lleva entregados su rival y los puntos acumulados.
  * **Pantalla de Victoria / Derrota**: Al llegar el reloj a cero, se declara al ganador ("Rey del Diner") con animación de confeti y opción de revancha inmediata.
* **Ranking Global de Puntuaciones (Leaderboard)**:
  * Tabla de clasificación accesible desde el menú principal y al finalizar cada partida (*Game Over* o fin de jornada).
  * Muestra el nombre o alias elegido por el jugador, puntaje total, propinas recaudadas y el nivel máximo alcanzado.
* **Filtros de competición**:
  * Puntuaciones del día / semana (mejores cocineros de la jornada).
  * Récord histórico global (Hall of Fame del Diner).
* **Compartir en redes sociales**:
  * Botón para generar una tarjeta visual retro con el resumen de la partida (*"¡Atendí a 20 clientes y gané $150 en propinas en Retro Diner Hot Dog!"*) lista para compartir con un enlace directo al juego.
